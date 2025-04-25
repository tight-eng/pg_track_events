import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/auth"
import { Icons } from "@/components/ui/icons"

export function SignInForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome to TightCRM</CardTitle>
          <CardDescription>
            Use your preferred method to sign in or register
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                {/* <form
                  action={async () => {
                    "use server"
                    await signIn("google")
                  }}>
                  <Button variant="outline" className="w-full" type="submit">
                    <Icons.google className="w-4 h-4" />
                    Continue with Google
                  </Button>
                </form> */}
                <form
                  action={async () => {
                    "use server"
                    await signIn("slack")
                  }}>
                  <Button variant="outline" className="w-full" type="submit">
                    <Icons.slack className="w-4 h-4" />
                    Continue with Slack
                  </Button>
                </form>
              </div>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
              <form
                action={async (formData: FormData) => {
                  "use server"
                  await signIn("resend", {
                    email: formData.get("email"),
                    redirect: true,
                  })
                }}
                className="grid gap-4"
              >
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="me@company.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Send Magic Link
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
