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
  default     = "cx32"
}

variable "db_server_type" {
  description = "Servertyp der DB-VM (PostgreSQL 17, pgBackRest)."
  type        = string
  default     = "cx32"
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
