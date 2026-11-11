#!/bin/sh
# Aplica las migraciones pendientes y, con SEED=1, carga los datos de demostración.
# Atención: el seed borra los datos existentes; úselo solo en una base nueva o de pruebas.
set -e
npx prisma migrate deploy
if [ "$SEED" = "1" ]; then
  echo "Cargando datos de demostración (SEED=1)…"
  npm run seed
fi
