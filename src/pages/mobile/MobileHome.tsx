import { useAuth } from "@/contexts/AuthContext";

export default function MobileHome() {
    const { user } = useAuth();

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-bold">Inicio</h1>
            <div className="bg-white dark:bg-[#1c2630] p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold mb-2">Bienvenido, {user?.user_metadata?.full_name || user?.email}</h2>
                <p className="text-gray-500">Selecciona "Finanzas" en el menú inferior para ver el estado del curso.</p>
            </div>
        </div>
    );
}
