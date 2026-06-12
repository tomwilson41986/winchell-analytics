import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Horses from './pages/Horses'
import Portfolio from './pages/Portfolio'
import HorseProfile from './pages/Portfolio/HorseProfile'
import Sales from './pages/Sales'
import LiveSales from './pages/Sales/LiveSales'
import HistoricSales from './pages/Sales/HistoricSales'
import HistoricSalesAnalysis from './pages/Sales/HistoricSalesAnalysis'
import Sires from './pages/Sires'
import Broodmares from './pages/Broodmares'
import JapanProspects from './pages/Broodmares/JapanProspects'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="horse/:horseId" element={<HorseProfile />} />
        <Route path="horses" element={<Horses />} />
        <Route path="sales">
          <Route index element={<Sales />} />
          <Route path="live" element={<LiveSales />} />
          <Route path="historic" element={<HistoricSales />} />
          <Route path="historic-sales-analysis" element={<HistoricSalesAnalysis />} />
        </Route>
        <Route path="sires" element={<Sires />} />
        <Route path="broodmares">
          <Route index element={<Broodmares />} />
          <Route path="japan-prospects" element={<JapanProspects />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
