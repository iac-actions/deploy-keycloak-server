#!/bin/bash

# Ensure SSH host IP and domain are set in the environment
echo "Setting up hosts file with the provided SSH details."

cat << EOF > ansible/hosts/inventory
[all]
ssh_host ansible_host=${SSH_HOST_IP} ansible_user=${SSH_USER} ansible_ssh_private_key_file=${SSH_PRIVATE_KEY}

[web]
ssh_host ansible_host=${SSH_HOST_IP} ansible_user=${SSH_USER} ansible_ssh_private_key_file=${SSH_PRIVATE_KEY}
EOF
