import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Horses from './pages/Horses'
import Sales from './pages/Sales'
import Sires from './pages/Sires'
import Broodmares from './pages/Broodmares'
import JapanProspects from './pages/Broodmares/JapanProspects'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="horses" element={<Horses />} />
        <Route path="sales" element={<Sales />} />
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
