/**
 * FormFields.tsx — compatibility shim
 *
 * All existing imports like:
 *   import { Field, Input, Textarea, Select } from '@/components/ui/FormFields'
 * continue to work without changes.
 *
 * Internally re-exports from the new shadcn-aligned components.
 */

export { Input } from "@/components/ui/input";
export { Textarea } from "@/components/ui/textarea";
export { Select } from "@/components/ui/select";
export { Label, Field } from "@/components/ui/form-field";
