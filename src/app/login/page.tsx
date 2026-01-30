import { LoginForm } from './login-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">Ronda Planner</CardTitle>
            <CardDescription>Masuk untuk mengelola jadwal ronda</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
