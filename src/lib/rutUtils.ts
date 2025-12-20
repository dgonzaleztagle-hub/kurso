export function formatRut(rut: string): string {
    if (!rut) return "";
    // Limpiar caracteres no válidos
    let value = rut.replace(/[^0-9kK]/g, "");

    if (value.length <= 1) return value;

    // Separar cuerpo y dígito verificador
    const dv = value.slice(-1).toUpperCase();
    const body = value.slice(0, -1);

    // Si el cuerpo es muy corto (recién escribiendo), devolver como está
    if (body.length < 1) return value;

    // Agregar puntos (separador de miles) - Opcional, el usuario pidió "12345678-9" (sin puntos)
    // Pero el usuario dijo "12.691.078-9" y "12691078-9". 
    // La decisión fue "Guardar en BD como 12691078-9" (Sin puntos, con guión).
    // Así que NO agregamos puntos, solo el guión.

    return `${body}-${dv}`;
}

export function validateRut(rut: string): boolean {
    if (!rut) return false;

    // Standardize common separators
    const cleanRut = rut.replace(/[^0-9kK]/g, "");

    if (cleanRut.length < 8) return false; // Min length check (e.g. 1.111.111-1)

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();

    if (!/^\d+$/.test(body)) return false;

    // Calculate DV
    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const rest = 11 - (sum % 11);
    const calculatedDv = rest === 11 ? '0' : rest === 10 ? 'K' : rest.toString();

    return calculatedDv === dv;
}

export function cleanRutForDB(rut: string): string {
    // Returns XXXXXXXX-Y format
    if (!rut) return "";
    const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
    if (clean.length < 2) return clean;

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body}-${dv}`;
}

export function generateRutEmail(rut: string): string {
    // Returns XXXXXXXXK@kurso.cl (Body + DV)
    // Matches logic in generate_accounts.ts
    const clean = rut.replace(/[^0-9kK]/g, "").toLowerCase(); // Lowercase for email
    if (clean.length < 2) return "";

    return `${clean}@kurso.cl`;
}
