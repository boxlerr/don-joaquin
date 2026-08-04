interface PageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start sm:items-center justify-between gap-x-4 gap-y-3 mb-4 sm:mb-6">
      <div className="min-w-0">
        {/* En celular el título baja a 20px: a 24px los nombres largos
            ("Liquidaciones de fletes") se comían dos renglones enteros. */}
        <h1 className="text-foreground text-xl sm:text-2xl font-semibold leading-tight">{title}</h1>
        <p className="text-muted-foreground text-[13px] sm:text-sm mt-0.5">{description}</p>
      </div>
      {/* `ml-auto` sólo desde sm: en celular la acción arranca a la izquierda,
          debajo del título, en vez de quedar apretada contra el borde. */}
      {action && (
        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  );
}
