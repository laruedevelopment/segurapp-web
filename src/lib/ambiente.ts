// ¿Es la copia de pruebas? Se lee el ambiente directo (sin importar el cliente de Supabase) para poder
// usarlo en módulos que se prueban sin las claves de la base. La copia de producción vale 'prod'.
export const ES_AMBIENTE_PRUEBAS = ((import.meta.env.VITE_APP_ENV as string | undefined) ?? 'dev') !== 'prod'
