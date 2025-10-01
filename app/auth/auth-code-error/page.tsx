import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-red-600">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-center">
            Something went wrong during the authentication process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              We encountered an error while trying to sign you in. This could be due to:
            </p>
            <ul className="text-sm text-muted-foreground text-left space-y-1">
              <li>• Invalid or expired authentication code</li>
              <li>• Network connectivity issues</li>
              <li>• Authentication service temporarily unavailable</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/login">
                Try Again
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">
                Go Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}