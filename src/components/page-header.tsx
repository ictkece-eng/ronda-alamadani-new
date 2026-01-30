import { SidebarTrigger } from "@/components/ui/sidebar";

type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 md:py-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
    </div>
  );
}
