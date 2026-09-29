"use client"

import * as React from "react"
import { cn } from "cn"
import { Dialog as SheetPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { isDesktop } from "@/lib/media"

/**
 * While a sheet is open on a phone or tablet, keeps --keyboard-inset (how much
 * of the screen the on-screen keyboard covers) and --visible-height (what's
 * left) up to date, so the sheet can sit above the keyboard. iOS Safari
 * doesn't resize the page for the keyboard, only the visual viewport.
 */
function KeyboardInset() {
  React.useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport || isDesktop()) return
    const root = document.documentElement

    function update() {
      if (!viewport) return
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`)
      root.style.setProperty("--visible-height", `${Math.round(viewport.height)}px`)
    }

    function resize() {
      update()
      // The sheet just got shorter, so bring the field being typed in back into view.
      requestAnimationFrame(() => {
        const field = document.activeElement
        if (field instanceof HTMLElement && field.closest("[data-slot=sheet-content]")) {
          field.scrollIntoView({ block: "nearest" })
        }
      })
    }

    update()
    viewport.addEventListener("resize", resize)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", resize)
      viewport.removeEventListener("scroll", update)
      root.style.removeProperty("--keyboard-inset")
      root.style.removeProperty("--visible-height")
    }
  }, [])

  return null
}

/**
 * Sheet content that fits the device. On phones and tablets it's a bottom
 * sheet that rides above the keyboard, kept to a readable width on wider
 * screens. On PCs it's a centered dialog with no sliding. Either way it focuses itself on open, not its first field, so the
 * keyboard doesn't cover it before it's read. Use inside `Sheet`.
 */
function ResponsiveSheetContent({
  className,
  children,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/10 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        {...props}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto overscroll-contain bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg outline-none",
          "touch:inset-x-0 touch:sm:mx-auto touch:sm:max-w-lg touch:sm:border-x touch:bottom-[var(--keyboard-inset,0px)] touch:max-h-[min(92dvh,calc(var(--visible-height,100dvh)-1rem))] touch:rounded-t-2xl touch:border-t touch:pb-[calc(1rem+env(safe-area-inset-bottom))] touch:duration-300 touch:ease-[cubic-bezier(0.32,0.72,0,1)] touch:data-open:animate-in touch:data-open:slide-in-from-bottom touch:data-closed:animate-out touch:data-closed:slide-out-to-bottom touch:data-closed:duration-200",
          "desktop:top-1/2 desktop:left-1/2 desktop:max-h-[85dvh] desktop:w-[calc(100%-2rem)] desktop:max-w-lg desktop:-translate-x-1/2 desktop:-translate-y-1/2 desktop:rounded-xl desktop:pb-4 desktop:ring-1 desktop:ring-foreground/10 desktop:duration-150 desktop:data-open:animate-in desktop:data-open:fade-in-0 desktop:data-open:zoom-in-95 desktop:data-closed:animate-out desktop:data-closed:fade-out-0 desktop:data-closed:zoom-out-95",
          className
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
        }}
      >
        <KeyboardInset />
        {children}
        <SheetPrimitive.Close data-slot="sheet-close" asChild>
          <Button variant="ghost" className="absolute top-3 right-3" size="icon-sm">
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export { ResponsiveSheetContent }
