# OpenTofu für die VMs von PPM im bestehenden Hetzner-Cloud-Projekt (deploy/hetzner/README.md).
# Backend S3 (Hetzner Object Storage, Werte per -backend-config aus .github/workflows/infra.yml bzw. backend.hcl),
# State und Plan verschlüsselt (Passphrase TF_STATE_PASSPHRASE wie infra/keycloak). Anmeldung des Providers nur über
# die Umgebung (HCLOUD_TOKEN), nie in Variablen oder im Plan.

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
