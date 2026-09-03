import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";

export default function ForbiddenPage() {
  return <AuthShell title="Access restricted" description="Your account does not have permission to access this area."><div className="space-y-5"><Alert variant="danger" title="You cannot open this workspace">Your role is not authorized for the requested route. Return to your assigned workspace to continue.</Alert><Link className={buttonClasses({ variant: "outline", size: "lg", className: "w-full" })} href="/auth/continue">Return to your workspace</Link></div></AuthShell>;
}
