# Media Server Manager

Dashboard local para observar y operar de forma segura el stack de
[`media-server`](https://github.com/juanfranciscofernandezherreros/media-server).

El manager crea una **capa de operación propia** encima del stack para responder
rápidamente a preguntas como: ¿están sanos los contenedores?, ¿Deluge sigue
aislado detrás de Gluetun?, ¿Tailscale está activo?, ¿cuánta capacidad queda? y
¿hay paneles administrativos publicados accidentalmente?

## MVP 0.1.0

- dashboard web responsive;
- estado real de Jellyfin, Gluetun, Deluge, Sonarr, Radarr, Prowlarr, Bazarr,
  Jellyseerr, Tailscale y Samba;
- health, uptime, reinicios, imagen, modo de red y puertos publicados;
- CPU, RAM, disco y temperatura cuando el host la expone;
- diagnóstico de exposición de puertos, aislamiento Deluge/Gluetun, Tailscale,
  health de contenedores y capacidad de disco;
- reinicio de contenedores limitado por allowlist;
- token obligatorio para acciones mutantes;
- una sola aplicación FastAPI que sirve API + frontend;
- Dockerfile, Compose, tests y GitHub Actions.

## Arquitectura

```text
Browser
   │
   ▼
Media Server Manager :8088
   │
   ├── FastAPI REST API
   ├── Static dashboard
   ├── psutil ───────────► CPU / RAM / disk
   └── Docker SDK ───────► Docker Engine
                            │
                            ├─ Jellyfin
                            ├─ Gluetun / Deluge
                            ├─ Sonarr / Radarr
                            ├─ Prowlarr / Bazarr
                            ├─ Jellyseerr
                            └─ Tailscale / Samba
```

El navegador **nunca** recibe acceso al Docker socket. Solo el backend habla con
Docker y las acciones están restringidas a una lista explícita de contenedores.

## Arranque rápido en Linux

```bash
git clone https://github.com/juanfranciscofernandezherreros/media-server-manager.git
cd media-server-manager
cp .env.example .env
```

Edita `.env`:

```env
MANAGER_API_TOKEN=pon-aqui-un-token-largo-y-aleatorio
MEDIA_SERVER_ROOT=/ruta/al/media-server
```

Obtén el GID del socket Docker:

```bash
stat -c '%g' /var/run/docker.sock
```

Y añádelo a `.env`, por ejemplo:

```env
DOCKER_GID=999
```

Después:

```bash
docker compose up -d --build
```

Abre desde el propio host:

```text
http://localhost:8088
```

Por defecto el puerto se publica solo en `127.0.0.1`.

## Windows / Docker Desktop

El contenedor puede ejecutarse también en Docker Desktop. Docker Desktop puede
montar `/var/run/docker.sock` como `root:root` con permisos `0660`; el Compose
incluye el grupo suplementario `0` para que el usuario no-root `manager` pueda
acceder al socket sin ejecutar toda la aplicación como root.

PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8088
```

Después abre `http://localhost:8088`.

**No habilites Docker TCP sin TLS** solo para hacer funcionar este dashboard.

## Token para acciones

Las consultas son de solo lectura. Para reiniciar un servicio:

1. define `MANAGER_API_TOKEN` en el backend;
2. abre el dashboard;
3. pulsa **Configurar token de acciones**;
4. introduce el mismo valor.

El token se guarda únicamente en `localStorage` del navegador y se envía en la
cabecera `X-Manager-Token` para acciones mutantes.

Si el token está vacío o conserva `change-me`, las acciones quedan
deshabilitadas en el servidor.

## Allowlist

El backend no acepta nombres arbitrarios para controlar Docker. Solo permite los
definidos en:

```env
MANAGER_ALLOWED_SERVICES=jellyfin,gluetun,deluge,sonarr,radarr,prowlarr,bazarr,jellyseerr,tailscale,samba
```

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Health del manager |
| GET | `/api/overview` | Payload principal del dashboard |
| GET | `/api/services` | Estado de contenedores |
| GET | `/api/system` | CPU, RAM, disco y temperatura |
| GET | `/api/diagnostics` | Checks operativos |
| POST | `/api/services/{service}/restart` | Reinicio permitido + token |

FastAPI expone también OpenAPI en `/docs`.

## Seguridad

- UI ligada a localhost por defecto;
- Docker socket accesible solo desde el backend;
- frontend sin ejecución arbitraria de comandos;
- acciones mutantes con token;
- servicios controlables restringidos por allowlist;
- contenedor no-root con GID suplementario del socket Docker;
- `no-new-privileges` en Compose;
- ningún puerto del router es necesario.

### Docker socket

Incluso montado como `:ro`, el Docker socket sigue siendo una interfaz
privilegiada del daemon. El sufijo `:ro` no transforma la API de Docker en una
API de solo lectura.

Por eso el backend debe tratarse como un componente privilegiado y permanecer
en localhost o una red privada. Una evolución prevista es colocar un proxy de
Docker de mínimo privilegio entre el manager y el daemon.

## Desarrollo

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
ruff check app tests
pytest -q
uvicorn app.main:app --reload --port 8088
```

En PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

## Roadmap

**0.2**: Prometheus histórico, Jellyfin API, Deluge API, streams, bibliotecas,
descargas activas y actividad reciente.

**0.3**: backups, restore checks, actualizaciones controladas, notificaciones,
autenticación más fuerte y Docker socket proxy.

**1.0**: instalador guiado, multi-host, configuración desde UI, upgrades con
rollback y despliegue opcional integrado en `media-server`.

## Separación de responsabilidades

```text
media-server
  └─ infraestructura, networking, servicios y observabilidad

media-server-manager
  └─ experiencia de operación, diagnóstico y control
```

Así la aplicación puede evolucionar sin mezclar la UI/API con la infraestructura
base.
