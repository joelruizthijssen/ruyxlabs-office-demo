import Sidebar from './Sidebar.jsx';

function Layout({ children }) {
  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 p-8">
        {children}
      </main>
    </div>
  );
}

export default Layout;
