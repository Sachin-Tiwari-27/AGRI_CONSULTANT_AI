'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CreateProjectModal } from '@/components/project/CreateProjectModal'
import { Plus } from 'lucide-react'

export function NewProjectButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> New project
      </Button>
      {open && <CreateProjectModal onClose={() => setOpen(false)} />}
    </>
  )
}
