import * as React from "react"

import { cn } from "@/lib/tiptap-utils"
import "@/components/tiptap-ui-primitive/input/input.scss"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="tiptap-input"
        className={cn("tiptap-input", className)}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
