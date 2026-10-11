// Copy of apps/v4/app/(app)/(create)/components/picker.tsx (the parts the
// font picker uses), so the extension is tested against the same DOM.
import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

const cn = (...classes: (string | undefined | false)[]) =>
  classes.filter(Boolean).join(" ")

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function Picker(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

export function PickerTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn(
        "relative w-36 shrink-0 touch-manipulation rounded-xl p-3 ring-1 ring-foreground/10 select-none hover:bg-muted focus-visible:ring-foreground/50 focus-visible:outline-none disabled:opacity-50 data-popup-open:bg-muted md:w-full md:rounded-lg md:px-2.5 md:py-2",
        className as string
      )}
      {...props}
    />
  )
}

export function PickerContent({
  align = "start",
  side = "right",
  sideOffset = 20,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "cn-menu-target z-50 max-h-(--available-height) w-[calc(var(--available-width)-(--spacing(6)))] min-w-32 origin-(--transform-origin) translate-y-2 overflow-x-hidden overflow-y-auto rounded-xl border-0 bg-neutral-950/80 p-1.5 text-neutral-100 ring-1 ring-neutral-950/80 backdrop-blur-xl outline-none md:w-52 data-closed:overflow-hidden",
            className as string
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

export function PickerGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

export function PickerLabel(props: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className="px-2 py-1.5 text-xs font-medium text-neutral-400 data-inset:pl-8"
      {...props}
    />
  )
}

export function PickerSeparator() {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className="-mx-1.5 my-1.5 h-px bg-neutral-600"
    />
  )
}

const PickerPreviewContext = React.createContext<((value: string) => void) | null>(
  null
)

export function PickerRadioGroup({
  onItemPreview,
  ...props
}: MenuPrimitive.RadioGroup.Props & { onItemPreview?: (value: string) => void }) {
  return (
    <PickerPreviewContext.Provider value={onItemPreview ?? null}>
      <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
    </PickerPreviewContext.Provider>
  )
}

export function PickerRadioItem({
  children,
  value,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  const onItemPreview = React.useContext(PickerPreviewContext)
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      value={value}
      onMouseMove={() => onItemPreview?.(value as string)}
      onFocus={() => onItemPreview?.(value as string)}
      className="relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm font-medium outline-hidden select-none **:text-neutral-100 focus:bg-neutral-600 focus:text-neutral-100 focus:**:text-neutral-100 data-inset:pl-8 pointer-coarse:gap-3 pointer-coarse:py-2.5 pointer-coarse:pl-3 pointer-coarse:text-base data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon className="size-4 pointer-coarse:size-5" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}
