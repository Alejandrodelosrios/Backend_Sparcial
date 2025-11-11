import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

// Use DATABASE_URL when provided (Neon), otherwise fall back to individual DB_* vars
const connectionString = process.env.DATABASE_URL ;

const pool = new Pool({
  connectionString,
  // Neon requiere SSL; rechazamos la verificación del certificado para evitar problemas con certificados auto-gestionados.
  // Cuando se despliegue en producción con un proveedor que soporte certificados válidos, ajustar según sea necesario.
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

export default pool;
