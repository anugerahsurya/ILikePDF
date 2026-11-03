import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'

const MergePdf = lazy(() => import('./pages/MergePdf'))
const SplitPdf = lazy(() => import('./pages/SplitPdf'))
const OrganizePdf = lazy(() => import('./pages/OrganizePdf'))
const RemovePage = lazy(() => import('./pages/RemovePage'))
const RotatePdf = lazy(() => import('./pages/RotatePdf'))
const CropPdf = lazy(() => import('./pages/CropPdf'))
const CompressPdf = lazy(() => import('./pages/CompressPdf'))
const PdfToWord = lazy(() => import('./pages/PdfToWord'))
const WordToPdf = lazy(() => import('./pages/WordToPdf'))
const PdfToImage = lazy(() => import('./pages/PdfToPng'))
const ImageToPdf = lazy(() => import('./pages/ConvertPdf'))
const PageNumbers = lazy(() => import('./pages/PageNumbers'))
const AddSignature = lazy(() => import('./pages/AddSignature'))
const WatermarkPdf = lazy(() => import('./pages/WatermarkPdf'))
const RemoveWatermark = lazy(() => import('./pages/RemoveWatermark'))
const RedactPdf = lazy(() => import('./pages/RedactPdf'))
const ProtectPdf = lazy(() => import('./pages/ProtectPdf'))
const UnlockPdf = lazy(() => import('./pages/UnlockPdf'))
const CompressImage = lazy(() => import('./pages/CompressImage'))
const ResizeImage = lazy(() => import('./pages/ResizeImage'))
const ConvertImage = lazy(() => import('./pages/ConvertImage'))
const WatermarkImage = lazy(() => import('./pages/WatermarkImage'))

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
              <Route path="/organize-pdf" element={<OrganizePdf />} />
              <Route path="/remove-page" element={<RemovePage />} />
              <Route path="/rotate" element={<RotatePdf />} />
              <Route path="/crop-pdf" element={<CropPdf />} />
              <Route path="/compress" element={<CompressPdf />} />
              <Route path="/pdf-to-word" element={<PdfToWord />} />
              <Route path="/word-to-pdf" element={<WordToPdf />} />
              <Route path="/pdf-to-image" element={<PdfToImage />} />
              <Route path="/image-to-pdf" element={<ImageToPdf />} />
              <Route path="/page-numbers" element={<PageNumbers />} />
              <Route path="/signature" element={<AddSignature />} />
              <Route path="/watermark" element={<WatermarkPdf />} />
              <Route path="/remove-watermark" element={<RemoveWatermark />} />
              <Route path="/watermark-remover" element={<Navigate to="/remove-watermark" replace />} />
              <Route path="/clean-watermark" element={<Navigate to="/remove-watermark" replace />} />
              <Route path="/redact-pdf" element={<RedactPdf />} />
              <Route path="/protect-pdf" element={<ProtectPdf />} />
              <Route path="/unlock" element={<UnlockPdf />} />
              <Route path="/compress-image" element={<CompressImage />} />
              <Route path="/resize-image" element={<ResizeImage />} />
              <Route path="/convert-image" element={<ConvertImage />} />
              <Route path="/watermark-image" element={<WatermarkImage />} />
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
