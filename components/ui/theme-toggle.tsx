"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ThemeSelector() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="space-y-3">
      <label
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          theme === "light"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onClick={() => setTheme("light")}
      >
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            theme === "light" ? "border-primary" : "border-muted-foreground"
          }`}
        >
          {theme === "light" && (
            <div className="w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <Sun className="h-4 w-4" />
        <span className="text-sm font-medium">Light</span>
      </label>

      <label
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          theme === "dark"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onClick={() => setTheme("dark")}
      >
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            theme === "dark" ? "border-primary" : "border-muted-foreground"
          }`}
        >
          {theme === "dark" && (
            <div className="w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <Moon className="h-4 w-4" />
        <span className="text-sm font-medium">Dark</span>
      </label>

      <label
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          theme === "system"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onClick={() => setTheme("system")}
      >
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            theme === "system" ? "border-primary" : "border-muted-foreground"
          }`}
        >
          {theme === "system" && (
            <div className="w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <Monitor className="h-4 w-4" />
        <span className="text-sm font-medium">System</span>
        <span className="text-xs text-muted-foreground ml-auto">
          (follows your device settings)
        </span>
      </label>
    </div>
  )
}
