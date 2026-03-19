import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function NotFound() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '404 Not Found | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="text-8xl font-bold text-gray-100 select-none">404</div>
      <h1 className="text-xl font-semibold text-gray-900 -mt-4">Page not found</h1>
      <p className="text-sm text-gray-500 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button variant="primary" size="sm" onClick={() => navigate('/')}>
        Back to Dashboard
      </Button>
    </div>
  )
}
