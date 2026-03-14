import { assembleContract, ownerModifier } from './templateUtils';

export function generateERC1155(config, features) {
  const imports = ['@openzeppelin/contracts/token/ERC1155/ERC1155.sol'];
  const inheritance = ['ERC1155'];
  const constructorArgs = ['string memory uri_'];
  const constructorBody = [];
  const functions = [];
  const stateVars = [];

  if (features.burnable) {
    imports.push('@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol');
    inheritance.push('ERC1155Burnable');
  }

  if (features.pausable) {
    imports.push('@openzeppelin/contracts/utils/Pausable.sol');
    inheritance.push('Pausable');
    functions.push(
      `function pause() public ${ownerModifier(features.accessControl)} {\n        _pause();\n    }`,
      `function unpause() public ${ownerModifier(features.accessControl)} {\n        _unpause();\n    }`
    );
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

  const modifier = features.accessControl === 'roles' ? 'onlyRole(MINTER_ROLE)' : ownerModifier(features.accessControl);

  functions.push(
    `function mint(address to, uint256 id, uint256 amount, bytes memory data) public ${modifier} {\n        _mint(to, id, amount, data);\n    }`
  );

  functions.push(
    `function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) public ${modifier} {\n        _mintBatch(to, ids, amounts, data);\n    }`
  );

  functions.push(
    `function setURI(string memory newuri) public ${ownerModifier(features.accessControl)} {\n        _setURI(newuri);\n    }`
  );

  if (features.accessControl === 'roles') {
    functions.push(
      `function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {\n        return super.supportsInterface(interfaceId);\n    }`
    );
  }

  return assembleContract({
    imports,
    contractName: config.contractName || 'MyMultiToken',
    inheritance,
    constructorArgs,
    constructorBody,
    functions,
    stateVars,
  });
}
