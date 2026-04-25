export default function ManualPage() {
  const baseUrl = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] px-6 text-center">
      <img
        src={`${baseUrl}/favicon.jpeg`}
        alt="MultiCRM"
        className="w-48 h-48 sm:w-64 sm:h-64 rounded-3xl object-contain mb-8 shadow-lg"
        onError={(e) => { e.target.src = `${baseUrl}/favicon.svg`; }}
      />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">En construccion</h1>
      <p className="text-base sm:text-lg text-muted-foreground max-w-md">
        Estamos trabajando en el manual de usuario. Vuelva pronto.
      </p>
    </div>
  );
}
