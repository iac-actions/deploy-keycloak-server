const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 设置环境变量并创建 Ansible Vault 密码文件。
 * 返回主要输入参数（如 domain 和 sudoPassword）。
 */
function setupEnvironmentVariables() {
  try {
    // 获取输入和秘密
    const domain = core.getInput('domain');
    const sshHostIP = core.getInput('ssh_host_ip');
    const sshHostName = core.getInput('ssh_host_name');
    const sshHostDomain = core.getInput('ssh_host_domain') || `${sshHostName}.${domain}`;
    const registry = core.getInput('registry') || '';

    const sshUser = core.getSecret('SSH_USER');
    const sshPrivateKey = core.getSecret('SSH_PRIVATE_KEY');
    const sudoPassword = core.getSecret('SUDO_PASSWORD') || '';
    const ansibleVaultPassword = core.getSecret('ANSIBLE_VAULT_PASSWORD');

    // 导出环境变量
    core.exportVariable('DOMAIN', domain);
    core.exportVariable('REGISTRY', registry);
    core.exportVariable('SSH_USER', sshUser);
    core.exportVariable('SUDO_PASSWORD', sudoPassword);
    core.exportVariable('SSH_PRIVATE_KEY', sshPrivateKey);
    core.exportVariable('SSH_HOST_IP', sshHostIP);
    core.exportVariable('SSH_HOST_DOMAIN', sshHostDomain);

    // 创建 Ansible Vault 密码文件
    const vaultPasswordPath = path.join(process.env.HOME, '.vault_password');
    fs.writeFileSync(vaultPasswordPath, ansibleVaultPassword);
    fs.chmodSync(vaultPasswordPath, '0644');

    console.log('环境变量和 Ansible Vault 密码文件已成功设置。');
    return { domain, sudoPassword };
  } catch (error) {
    core.setFailed('设置环境变量失败: ' + error.message);
    throw error;
  }
}

/**
 * 初始化 Ansible 环境，安装所需依赖。
 */
async function initAnsible() {
  try {
    // 检测系统版本
    const osRelease = execSync('cat /etc/os-release').toString();
    const isUbuntu = osRelease.includes('Ubuntu');
    const isDebian = osRelease.includes('Debian');

    if (!isUbuntu && !isDebian) {
      throw new Error('不支持的操作系统。目前仅支持 Debian/Ubuntu。');
    }

    console.log('更新系统包...');
    await exec.exec('sudo apt-get update');

    console.log('安装依赖包...');
    await exec.exec('sudo apt-get install -y python3-pip jq');

    console.log('安装 Ansible 和相关 Python 库...');
    await exec.exec('pip3 install ansible jinja2 hvac');

    console.log('安装 Ansible Galaxy 集合...');
    await exec.exec('ansible-galaxy collection install community.hashi_vault');

    console.log('Ansible 环境初始化成功。');
  } catch (error) {
    core.setFailed('初始化 Ansible 环境失败: ' + error.message);
    throw error;
  }
}

/**
 * 更新 Ansible 主机文件。
 */
async function setupAnsibleHosts() {
  try {
    console.log('更新 Ansible 主机文件...');
    await exec.exec('bash', ['scripts/ansible_playbook_hosts_setup.sh'], {
      cwd: 'ansible',
    });
    console.log('Ansible 主机文件更新成功。');
  } catch (error) {
    core.setFailed('更新 Ansible 主机文件失败: ' + error.message);
    throw error;
  }
}

/**
 * 使用传入的参数执行 Ansible Playbook 部署 Keycloak。
 */
async function runAnsiblePlaybook(domain, sudoPassword) {
  try {
    const ansiblePlaybookCmd = [
      'ansible-playbook',
      '-i', 'hosts/inventory',
      'playbooks/deploy-docker-keycloak.yml',
      '-e', `ansible_become_pass=${sudoPassword}`,
      '-e', `domain=${domain}`,
      '-D',
    ];

    console.log('运行 Ansible Playbook 部署 Keycloak...');
    await exec.exec(ansiblePlaybookCmd.join(' '), [], {
      cwd: 'ansible',
    });
    console.log('Ansible Playbook 执行成功，Keycloak 部署完成。');
  } catch (error) {
    core.setFailed('执行 Ansible Playbook 失败: ' + error.message);
    throw error;
  }
}

/**
 * 主函数，按顺序调用各个步骤。
 */
async function run() {
  try {
    // 设置环境变量并创建 Ansible Vault 密码文件
    const { domain, sudoPassword } = setupEnvironmentVariables();

    // 初始化 Ansible 环境
    await initAnsible();

    // 更新 Ansible 主机文件
    await setupAnsibleHosts();

    // 执行 Ansible Playbook 部署 Keycloak
    await runAnsiblePlaybook(domain, sudoPassword);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
