// --accent is the brand cyan here, not shadcn's subtle hover tint, so menu
// highlights use muted -- the same fill rows hover with.
export const menuItemBaseClasses =
  "focus:bg-muted focus:text-foreground hover:bg-muted hover:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[state=checked]:bg-muted relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8";

export const menuItemInteractiveClasses =
  "data-[state=open]:bg-muted data-[state=open]:text-foreground";

export const menuItemDestructiveClasses =
  "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20";
