import { useEffect, useState } from 'react';
import { Atmosphere } from './components/Atmosphere';
import { MainMenu } from './screens/MainMenu';
import { JoinScreen } from './screens/JoinScreen';
import { RoomPage } from './screens/RoomPage';
import { BASE } from './lib/util';

type Route = { name: 'menu' } | { name: 'join' } | { name: 'room'; code: string };

function parse(fullPath: string): Route {
  const path = BASE && fullPath.startsWith(BASE) ? fullPath.slice(BASE.length) || '/' : fullPath;
  const m = path.match(/^\/(?:join|room)\/([A-Za-z0-9]{6})\/?$/);
  if (m) return { name: 'room', code: m[1].toUpperCase() };
  if (/^\/join\/?$/.test(path)) return { name: 'join' };
  return { name: 'menu' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.pathname));
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  if (route.name === 'room') return <RoomPage key={route.code} code={route.code} />;
  return (
    <>
      <Atmosphere />
      {route.name === 'join' ? <JoinScreen /> : <MainMenu />}
    </>
  );
}
