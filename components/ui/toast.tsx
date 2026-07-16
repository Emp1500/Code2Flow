"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed right-4 bottom-4 z-50 mx-auto flex w-[calc(100vw-2rem)] flex-col gap-2 sm:w-[22.5rem]",
        className
      )}
      {...props}
    />
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map(toast => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      className="relative w-full rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0"
    >
      <ToastPrimitive.Content className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ToastPrimitive.Title className="font-medium" />
          <ToastPrimitive.Description className="text-muted-foreground" />
        </div>
        <ToastPrimitive.Close render={<Button variant="ghost" size="icon-sm" />}>
          <XIcon />
        </ToastPrimitive.Close>
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  ))
}

function Toaster() {
  return (
    <ToastPrimitive.Portal data-slot="toast-portal">
      <ToastViewport>
        <ToastList />
      </ToastViewport>
    </ToastPrimitive.Portal>
  )
}

const useToastManager = ToastPrimitive.useToastManager

export { ToastProvider, Toaster, useToastManager }
