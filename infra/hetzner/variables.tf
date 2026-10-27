variable "state_passphrase" {
  description = "Passphrase der State-Verschlüsselung (TF_VAR_state_passphrase aus TF_STATE_PASSPHRASE)."
  type        = string
  sensitive   = true
}

variable "location" {
  description = "Standort der Server (Hetzner Cloud), z. B. nbg1, fsn1, hel1."
  type        = string
  default     = "nbg1"
}

variable "network_zone" {
  description = "Netzwerkzone passend zum Standort (eu-central für nbg1/fsn1, hel1)."
  type        = string
  default     = "eu-central"
}

variable "app_server_type" {
  description = "Servertyp der App-VM (Caddy, api, worker, mcp)."
  type        = string
  default     = "cx33"
}

variable "db_server_type" {
  description = "Servertyp der DB-VM (PostgreSQL 17, pgBackRest)."
  type        = string
  default     = "cx33"
}

variable "image" {
  description = "Betriebssystem der VMs."
  type        = string
  default     = "debian-13"
}

variable "db_volume_size" {
  description = "Grösse des Daten-Volumes der Datenbank in GB."
  type        = number
  default     = 40
}

variable "ssh_keys" {
  description = "Öffentliche SSH-Schlüssel der Betriebspersonen (Name → Schlüssel). Mindestens einer."
  type        = map(string)
  validation {
    condition     = length(var.ssh_keys) > 0
    error_message = "Mindestens ein SSH-Schlüssel nötig."
  }
}

variable "deploy_ssh_public_key" {
  description = "Öffentlicher Schlüssel des Workflows «Deploy» (Benutzer deploy, nur erzwungener Befehl ppm-ssh-gate). Leer = kein Deploy-Zugang."
  type        = string
  default     = ""
}

variable "admin_cidrs" {
  description = "Adressen, die SSH auf die VMs dürfen (z. B. Büro, VPN). Leer = SSH nur über das private Netz."
  type        = list(string)
  default     = []
}

variable "private_network_cidr" {
  description = "Privates Netz der Umgebung; die DB-VM ist nur hier erreichbar."
  type        = string
  default     = "10.0.0.0/16"
}

variable "app_private_ip" {
  description = "Feste private Adresse der App-VM."
  type        = string
  default     = "10.0.1.10"
}

variable "db_private_ip" {
  description = "Feste private Adresse der DB-VM (DATABASE_URL zeigt hierhin, TLS verify-full auf den Namen db.ppm.internal)."
  type        = string
  default     = "10.0.1.20"
}

variable "delete_protection" {
  description = "Löschschutz für Server, Volume und Netz (Produktion: true)."
  type        = bool
  default     = true
}

# ---------- Domain (Zone bei Infomaniak; Einträge setzt infra/dns aus der Ausgabe «dns»)

variable "dns_zone" {
  description = "DNS-Zone bei Infomaniak. infra/dns verwaltet darin nur die Einträge aus der Ausgabe «dns»."
  type        = string
  default     = "project-suite.ch"
}

variable "domain" {
  description = "Öffentlicher Host von PPM (PUBLIC_BASE_URL, MCP unter /mcp). Muss in dns_zone liegen."
  type        = string
  default     = "ppm.project-suite.ch"
  validation {
    condition     = endswith(var.domain, ".${var.dns_zone}")
    error_message = "domain muss ein Name unterhalb von dns_zone sein (nicht die Zone selbst)."
  }
}

variable "dns_ttl" {
  description = "TTL der DNS-Einträge in Sekunden (60–86400)."
  type        = number
  default     = 300
}
