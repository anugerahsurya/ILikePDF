import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'

const MergePdf = lazy(() => import('./pages/MergePdf'))
const SplitPdf = lazy(() => import('./pages/SplitPdf'))
const RemovePage = lazy(() => import('./pages/RemovePage'))
const RotatePdf = lazy(() => import('./pages/RotatePdf'))
const CompressPdf = lazy(() => import('./pages/CompressPdf'))
const PdfToImage = lazy(() => import('./pages/PdfToPng'))
const ImageToPdf = lazy(() => import('./pages/ConvertPdf'))
const AddSignature = lazy(() => import('./pages/AddSignature'))
const WatermarkPdf = lazy(() => import('./pages/WatermarkPdf'))
const UnlockPdf = lazy(() => import('./pages/UnlockPdf'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function PageFallback() {
  return (
    <div className="page-fallback">
      <span className="spinner spinner-lg" />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="app">
        <Header />
        <main className="shell main">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/merge" element={<MergePdf />} />
              <Route path="/split" element={<SplitPdf />} />
              <Route path="/remove-page" element={<RemovePage />} />
              <Route path="/rotate" element={<RotatePdf />} />
              <Route path="/compress" element={<CompressPdf />} />
              <Route path="/pdf-to-image" element={<PdfToImage />} />
              <Route path="/image-to-pdf" element={<ImageToPdf />} />
              <Route path="/signature" element={<AddSignature />} />
              <Route path="/watermark" element={<WatermarkPdf />} />
              <Route path="/unlock" element={<UnlockPdf />} />
              {/* Old links */}
              <Route path="/pdf-to-png" element={<Navigate to="/pdf-to-image" replace />} />
              <Route path="/convert" element={<Navigate to="/pdf-to-image" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
      <Toaster position="bottom-center" closeButton toastOptions={{ className: 'toast' }} />
    </HashRouter>
  )
}
