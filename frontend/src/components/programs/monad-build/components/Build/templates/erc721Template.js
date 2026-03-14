import { assembleContract, ownerModifier } from './templateUtils';

export function generateERC721(config, features) {
  const imports = ['@openzeppelin/contracts/token/ERC721/ERC721.sol'];
  const inheritance = ['ERC721'];
  const constructorArgs = ['string memory name_', 'string memory symbol_'];
  const constructorBody = [];
  const functions = [];
  const stateVars = ['uint256 private _nextTokenId;'];

  if (features.enumerable) {
    imports.push('@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol');
    inheritance.push('ERC721Enumerable');
  }

  if (features.uriStorage) {
    imports.push('@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol');
    inheritance.push('ERC721URIStorage');
  }

  if (features.burnable) {
    imports.push('@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol');
    inheritance.push('ERC721Burnable');
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

  if (config.maxSupply) {
    stateVars.push(`uint256 public constant MAX_SUPPLY = ${config.maxSupply};`);
  }

  if (config.baseURI) {
    functions.push(
      `function _baseURI() internal pure override returns (string memory) {\n        return "${config.baseURI}";\n    }`
    );
  }

  if (features.mintable || !features.accessControl) {
    const modifier = features.accessControl === 'roles' ? 'onlyRole(MINTER_ROLE)' : ownerModifier(features.accessControl);
    let mintFunc = `function safeMint(address to${features.uriStorage ? ', string memory uri' : ''}) public ${modifier} {`;
    mintFunc += `\n        uint256 tokenId = _nextTokenId++;`;
    if (config.maxSupply) {
      mintFunc += `\n        require(tokenId < MAX_SUPPLY, "Exceeds max supply");`;
    }
    mintFunc += `\n        _safeMint(to, tokenId);`;
    if (features.uriStorage) {
      mintFunc += `\n        _setTokenURI(tokenId, uri);`;
    }
    mintFunc += `\n    }`;
    functions.push(mintFunc);
  }

  if (features.royalties) {
    imports.push('@openzeppelin/contracts/token/common/ERC2981.sol');
    inheritance.push('ERC2981');
    const royaltyBps = (features.royaltyPercent || 5) * 100;
    constructorBody.push(`_setDefaultRoyalty(msg.sender, ${royaltyBps});`);
  }

  // Override supportsInterface if needed
  const needsSupportsInterface = features.enumerable || features.royalties || features.accessControl === 'roles';
  if (needsSupportsInterface) {
    const overrides = ['ERC721'];
    if (features.enumerable) overrides.push('ERC721Enumerable');
    if (features.uriStorage) overrides.push('ERC721URIStorage');
    if (features.royalties) overrides.push('ERC2981');
    if (features.accessControl === 'roles') overrides.push('AccessControl');
    functions.push(
      `function supportsInterface(bytes4 interfaceId) public view override(${overrides.join(', ')}) returns (bool) {\n        return super.supportsInterface(interfaceId);\n    }`
    );
  }

  if (features.enumerable || features.uriStorage) {
    const overrides = ['ERC721'];
    if (features.enumerable) overrides.push('ERC721Enumerable');
    if (features.uriStorage) overrides.push('ERC721URIStorage');
    functions.push(
      `function tokenURI(uint256 tokenId) public view override(${overrides.filter(o => o !== 'ERC721Enumerable').join(', ')}) returns (string memory) {\n        return super.tokenURI(tokenId);\n    }`
    );
    functions.push(
      `function _update(address to, uint256 tokenId, address auth) internal override(${overrides.join(', ')}) returns (address) {\n        return super._update(to, tokenId, auth);\n    }`
    );
    functions.push(
      `function _increaseBalance(address account, uint128 value) internal override(${overrides.join(', ')}) {\n        super._increaseBalance(account, value);\n    }`
    );
  }

  return assembleContract({
    imports,
    contractName: config.contractName || 'MyNFT',
    inheritance,
    constructorArgs,
    constructorBody,
    functions,
    stateVars,
  });
}
