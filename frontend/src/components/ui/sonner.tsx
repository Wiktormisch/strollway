import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * The shadcn version reads the theme from next-themes, which this Vite app does not use.
 * "system" follows the OS setting, like the rest of the app.
 */
export function Toaster(props: ToasterProps) {
  return <Sonner theme="system" position="top-center" richColors closeButton {...props} />
}
