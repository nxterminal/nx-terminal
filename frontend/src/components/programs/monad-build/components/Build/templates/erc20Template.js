import { assembleContract, ownerModifier } from './templateUtils';

export function generateERC20(config, features) {
  const imports = ['@openzeppelin/contracts/token/ERC20/ERC20.sol'];
  const inheritance = ['ERC20'];
  const constructorArgs = ['string memory name_', 'string memory symbol_'];
  const constructorBody = [];
  const functions = [];
  const stateVars = [];

  if (features.burnable) {
    imports.push('@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol');
    inheritance.push('ERC20Burnable');
  }

  if (features.pausable) {
    imports.push('@openzeppelin/contracts/utils/Pausable.sol');
    inheritance.push('Pausable');
    functions.push(
      `function pause() public ${ownerModifier(features.accessControl)} {\n        _pause();\n    }`,
      `function unpause() public ${ownerModifier(features.accessControl)} {\n        _unpause();\n    }`
    );
  }

  if (features.permit) {
    imports.push('@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol');
    inheritance.push('ERC20Permit');
  }

  if (features.accessControl === 'roles') {
    imports.push('@openzeppelin/contracts/access/AccessControl.sol');
    inheritance.push('AccessControl');
    stateVars.push('bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");');
    constructorArgs.push('address admin');
    constructorBody.push('_grantRole(DEFAULT_ADMIN_ROLE, admin);');
    constructorBody.push('_grantRole(MINTER_ROLE, admin);');
  } else {
    imports.push('@openzeppelin/contracts/access/Ownable.sol');
    inheritance.push('Ownable');
    constructorArgs.push('address initialOwner');
  }

  if (config.initialSupply) {
    const decimals = config.decimals || 18;
    constructorBody.push(`_mint(msg.sender, ${config.initialSupply} * 10 ** ${decimals});`);
  }

  if (config.maxSupply) {
    stateVars.push(`uint256 public constant MAX_SUPPLY = ${config.maxSupply} * 10 ** ${config.decimals || 18};`);
  }

  if (features.mintable) {
    const modifier = features.accessControl === 'roles' ? 'onlyRole(MINTER_ROLE)' : ownerModifier(features.accessControl);
    let mintFunc = `function mint(address to, uint256 amount) public ${modifier} {`;
    if (config.maxSupply) {
      mintFunc += `\n        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");`;
    }
    mintFunc += `\n        _mint(to, amount);\n    }`;
    functions.push(mintFunc);
  }

  if (features.pausable) {
    functions.push(
      `function _update(address from, address to, uint256 value) internal virtual override {
        require(!paused(), "Token transfers paused");
        super._update(from, to, value);
    }`
    );
  }

  return assembleContract({
    imports,
    contractName: config.contractName || 'MyToken',
    inheritance,
    constructorArgs,
    constructorBody,
    functions,
    stateVars,
  });
}
