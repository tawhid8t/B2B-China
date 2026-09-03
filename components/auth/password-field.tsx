"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/ui/cn";

export function PasswordField({ className, wrapperClassName, ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><Input {...props} type={visible ? "text" : "password"} wrapperClassName={wrapperClassName} className={cn("pr-12", className)} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="focus-ring absolute right-1 top-7 grid min-h-touch min-w-touch place-items-center rounded-control text-muted hover:text-foreground">{visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}</button></div>;
}
