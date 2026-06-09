import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Horses from './pages/Horses'
import Sales from './pages/Sales'
import HistoricSalesAnalysis from './pages/Sales/HistoricSalesAnalysis'
import Sires from './pages/Sires'
import Broodmares from './pages/Broodmares'
import JapanProspects from './pages/Broodmares/JapanProspects'
import DigestArchive from './pages/Broodmares/JapanProspects/DigestArchive'
import DigestDay from './pages/Broodmares/JapanProspects/DigestDay'
import ProspectDetail from './pages/Broodmares/JapanProspects/ProspectDetail'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="horses" element={<Horses />} />
        <Route path="sales">
          <Route index element={<Sales />} />
          <Route path="historic-sales-analysis" element={<HistoricSalesAnalysis />} />
        </Route>
        <Route path="sires" element={<Sires />} />
        <Route path="broodmares">
          <Route index element={<Broodmares />} />
          <Route path="japan-prospects">
            <Route index element={<JapanProspects />} />
            <Route path="digests" element={<DigestArchive />} />
            <Route path="digests/:date" element={<DigestDay />} />
            <Route path="prospect/:key" element={<ProspectDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
