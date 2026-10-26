# OpenTofu für die DNS-Einträge von PPM (ppm.project-suite.ch) in der DNS-Zone bei Hetzner (Hetzner Console, Provider
# hcloud). Backend und Verschlüsselung wie infra/hetzner; Anmeldung nur über HCLOUD_TOKEN aus der Umgebung.
# Liegt die Zone nicht bei Hetzner, dieses Verzeichnis durch den Provider des DNS-Anbieters ersetzen
# (docs/offene-punkte.md).

terraform {
  required_version = "~> 1.13.1"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "1.70.0"
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

provider "hcloud" {}
