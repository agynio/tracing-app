export const menuItemBaseClasses =
  "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8";

export const menuItemInteractiveClasses =
  "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground";

export const menuItemDestructiveClasses =
  "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20";
