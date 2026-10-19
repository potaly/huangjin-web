import { MallProvider } from '@/components/mall/MallProvider'
import { MallShell } from '@/components/mall/MallShell'

export default function MallLayout({ children }: { children: React.ReactNode }) {
  return (
    <MallProvider>
      <MallShell>{children}</MallShell>
    </MallProvider>
  )
}
