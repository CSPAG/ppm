# Alle Werte des bestehenden Projekts kommen als Variablen (keine IDs im Repository). Werte ohne Geheimnisse als
# Environment-Variablen in GitHub (infra.yml setzt TF_VAR_*), Geheimnisse nur als Secrets.

variable "state_passphrase" {
  description = "Passphrase der Verschlüsselung von State und Plan (Secret TF_STATE_PASSPHRASE)."
  type        = string
  sensitive   = true
}

variable "name_prefix" {
  description = "Vorsatz der Namen aller Ressourcen im Projekt (eindeutig neben anderen Apps im selben Projekt)."
  type        = string
  default     = "ppm"
}

variable "location" {
  description = "Standort der VMs und des Volumes (z. B. fsn1, nbg1, hel1)."
  type        = string
}

variable "image" {
  description = "Betriebssystem der VMs."
  type        = string
  default     = "ubuntu-24.04"
}

variable "app_server_type" {
  description = "Servertyp der App-VM (z. B. cx33 oder cax21 für arm64)."
  type        = string
}

variable "db_server_type" {
  description = "Servertyp der DB-VM."
  type        = string
}

variable "db_volume_size" {
  description = "Grösse des Volumes für die Daten von PostgreSQL in GB."
  type        = number
  default     = 40
}

variable "ssh_key_names" {
  description = "Namen bestehender SSH-Schlüssel im Projekt, die auf beide VMs kommen (Betrieb)."
  type        = list(string)
  default     = []
}

variable "deploy_ssh_public_key" {
  description = "Öffentlicher SSH-Schlüssel des Deploy-Workflows (Benutzer deploy, UID 1000); privat als Secret SSH_PRIVATE_KEY."
  type        = string
}

variable "admin_cidrs" {
  description = "Netze mit SSH-Zugang (Betrieb und GitHub-Runner bzw. Bastion), z. B. [\"203.0.113.10/32\"]."
  type        = list(string)
}

variable "network_ip_range" {
  description = "Adressbereich des privaten Netzes (muss zu deploy/hetzner/db/pg_hba.conf passen)."
  type        = string
  default     = "10.20.0.0/16"
}

variable "subnet_ip_range" {
  description = "Subnetz der VMs im privaten Netz."
  type        = string
  default     = "10.20.1.0/24"
}

variable "network_zone" {
  description = "Netzzone des Subnetzes (eu-central für fsn1, nbg1, hel1)."
  type        = string
  default     = "eu-central"
}

variable "app_private_ip" {
  description = "Private Adresse der App-VM."
  type        = string
  default     = "10.20.1.10"
}

variable "db_private_ip" {
  description = "Private Adresse der DB-VM (Ziel von DATABASE_URL, SAN im TLS-Zertifikat der Datenbank)."
  type        = string
  default     = "10.20.1.20"
}

variable "existing_network_name" {
  description = "Bestehendes privates Netz im Projekt nutzen statt ein neues anzulegen (leer = neu anlegen)."
  type        = string
  default     = ""
}

variable "labels" {
  description = "Zusätzliche Labels an allen Ressourcen."
  type        = map(string)
  default     = {}
}
