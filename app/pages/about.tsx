

export function About() {
  return (
    <main className="flex items-center justify-center pt-16 pb-4">
      <div className="flex-1 flex flex-col items-center gap-16 min-h-0">
        <header className="flex flex-col items-center gap-9">
          <h1 className="text-3xl font-bold">About</h1>
        </header>
        <div className="max-w-[300px] w-full space-y-6 px-4">
          <p className="text-gray-700 dark:text-gray-200 text-center">
            This is the about page.
          </p>
        </div>
      </div>
    </main>
  )
}