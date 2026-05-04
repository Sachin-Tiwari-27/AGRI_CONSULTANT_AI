import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendReportReady } from "@/lib/email.service";
import { generateReportPdfBuffer } from "@/lib/report-pdf";
import { logProjectEvent } from "@/lib/events";
import type { Report } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const serviceSupabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { projectId } = await req.json();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*, profiles!projects_consultant_id_fkey(full_name, company_name)")
    .eq("id", projectId)
    .single();

  if (projectError || !project || project.consultant_id !== user.id) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
  }

  const { data: reportData } = await supabase
    .from("reports").select("*").eq("project_id", projectId).single();

  if (!reportData) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  // Generate and upload PDF
  let pdfPath: string | null = null;
  try {
    const pdfBuffer = await generateReportPdfBuffer(reportData as Report, project.title);
    pdfPath = `${projectId}/${Date.now()}-report.pdf`;
    const { error: pdfUploadError } = await serviceSupabase.storage
      .from("reports")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (pdfUploadError) { console.error("[Publish] PDF upload failed:", pdfUploadError); pdfPath = null; }
  } catch (pdfErr) {
    console.error("[Publish] PDF generation failed:", pdfErr);
    pdfPath = null;
  }

  const { error: reportUpdateError } = await supabase
    .from("reports")
    .update({ status: "published", ...(pdfPath ? { pdf_url: pdfPath } : {}) })
    .eq("project_id", projectId);

  if (reportUpdateError) {
    return NextResponse.json({ error: "Failed to update report status", details: reportUpdateError.message }, { status: 500 });
  }

  // Determine new status
  // 1. If already completed (republish), keep it completed
  // 2. If price is 0, set to completed (free unlock)
  // 3. Otherwise report_published (waiting for payment)
  let newStatus = "report_published";
  let paymentCollected = project.payment_collected || false;

  if (project.status === "completed") {
    newStatus = "completed";
  } else if (project.report_price === 0) {
    newStatus = "completed";
    paymentCollected = true;
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ 
      status: newStatus,
      payment_collected: paymentCollected
    })
    .eq("id", projectId);

  if (projectUpdateError) {
    return NextResponse.json({ error: "Failed to update project status", details: projectUpdateError.message }, { status: 500 });
  }

  const warnings: string[] = [];
  if (!pdfPath) warnings.push("PDF generation failed — report published without PDF attachment.");

  try {
    const consultantProfile = project.profiles as { full_name?: string; company_name?: string } | null;
    const consultantName = consultantProfile?.full_name || user.email || "Your Consultant";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendReportReady({
      clientEmail: project.client_email,
      clientName: project.client_name,
      consultantName,
      projectTitle: project.title,
      projectId,
      previewUrl: `${appUrl}/project/${projectId}/report`,
    });
  } catch (emailError) {
    console.error("[Publish] Email failed:", emailError);
    const msg = emailError instanceof Error ? emailError.message : "Unknown email error";
    warnings.push(`Report published but client email failed to send: ${msg}.`);
  }

  // Log project event
  await logProjectEvent(supabase, {
    projectId,
    eventType: 'report_published',
    actor: 'consultant',
    title: 'Report published and sent to client',
    detail: `Client: ${project.client_email}${pdfPath ? ' · PDF generated' : ' · PDF unavailable'}`,
    metadata: {
      client_email: project.client_email,
      pdf_generated: !!pdfPath,
      report_price: project.report_price ?? null,
    },
  });

  return NextResponse.json({ 
    success: true, 
    status: newStatus,
    payment_collected: paymentCollected,
    ...(warnings.length > 0 ? { warnings } : {}) 
  });
}
