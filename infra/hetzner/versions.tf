# OpenTofu für die Hetzner-Umgebung von PPM (neues Hetzner-Projekt, Anleitung: deploy/hetzner/README.md).
# State im Object Storage (S3-Backend, Werte über -backend-config=backend.hcl), verschlüsselt mit TF_STATE_PASSPHRASE.

terraform {
  required_version = "~> 1.13.1"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "1.70.2"
    }
  }

  backend "s3" {}

  encryption {
    key_provider "pbkdf2" "state" {
      passphrase = var.state_passphrase
    }
    method "aes_gcm" "state" {
      keys = key_provider.pbkdf2.state
    }
    state {
      method   = method.aes_gcm.state
      enforced = true
    }
    plan {
      method   = method.aes_gcm.state
      enforced = true
    }
  }
}

# Token des Projekts nur aus der Umgebung (HCLOUD_TOKEN), nie in Variablen oder State
provider "hcloud" {}
