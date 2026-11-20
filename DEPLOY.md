# Despliegue de CosmoQMS

La guía completa de instalación, operación, respaldos, monitoreo y
actualización está en el
**[manual de administrador](docs/05-manual-de-administrador.md)**.

Resumen para levantar el sistema en un servidor con Docker:

```bash
cp .env.example .env     # complete contraseñas y llaves de Clerk
docker compose --profile https up -d --build
docker compose ps        # todos los servicios en healthy
```

Para desarrollo local y pruebas, vea el
[manual de desarrollador](docs/04-manual-de-desarrollador.md).
