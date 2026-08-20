import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'

type Theme = 'light' | 'dark'

function current(): Theme {
  return (document.documentElement.dataset.theme as Theme) ?? 'dark'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(current)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('life:theme', theme)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#09090b' : '#fafafa')
  }, [theme])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
