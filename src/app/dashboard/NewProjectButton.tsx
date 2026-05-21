"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/project/CreateProjectModal";
import { Plus } from "lucide-react";

export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New project
      </Button>
      {open && <CreateProjectModal onClose={() => setOpen(false)} />}
    </>
  );
}
