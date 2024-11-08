// SPDX-License-Identifier: MIT
// Creator: Chiru Labs

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error ApprovalCallerNotOwnerNorApproved();
error ApprovalQueryForNonexistentToken();
error ApproveToCaller();
error ApprovalToCurrentOwner();
error BalanceQueryForZeroAddress();
error MintedQueryForZeroAddress();
error BurnedQueryForZeroAddress();
error AuxQueryForZeroAddress();
error MintToZeroAddress();
error MintZeroQuantity();
error OwnerIndexOutOfBounds();
error OwnerQueryForNonexistentToken();
error TokenIndexOutOfBounds();
error TransferCallerNotOwnerNorApproved();
error TransferFromIncorrectOwner();
error TransferToNonERC721ReceiverImplementer();
error TransferToZeroAddress();
error URIQueryForNonexistentToken();

/**
 * @dev Implementation of https://eips.ethereum.org/EIPS/eip-721[ERC721] Non-Fungible Token Standard, including
 * the Metadata extension. Built to optimize for lower gas during batch mints.
 *
 * Assumes serials are sequentially minted starting at 0 (e.g. 0, 1, 2, 3..).
 *
 * Assumes that an owner cannot have more than 2**64 - 1 (max value of uint64) of supply.
 *
 * Assumes that the maximum token id cannot exceed 2**256 - 1 (max value of uint256).
 */
contract ERC721A is Ownable, ERC165, IERC721, IERC721Metadata {
    using Address for address;
    using Strings for uint256;

    // Compiler will pack this into a single 256bit word.
    struct TokenOwnership {
        // The address of the owner.
        address addr;
        // Keeps track of the start time of ownership with minimal overhead for tokenomics.
        uint64 startTimestamp;
        // Whether the token has been burned.
        bool burned;
    }

    // Compiler will pack this into a single 256bit word.
    struct AddressData {
        // Realistically, 2**64-1 is more than enough.
        uint64 balance;
        // Keeps track of mint count with minimal overhead for tokenomics.
        uint64 numberMinted;
        // Keeps track of burn count with minimal overhead for tokenomics.
        uint64 numberBurned;
        // For miscellaneous variable(s) pertaining to the address
        // (e.g. number of whitelist mint slots used).
        // If there are multiple variables, please pack them into a uint64.
        uint64 aux;
    }

    struct RateDistribute {
        address recipient;
        uint16 rate;
    }

    // The tokenId of the next token to be minted.
    uint256 internal _currentIndex;

    // The number of tokens burned.
    uint256 internal _burnCounter;

    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    /// Token base Uri
    string private _baseUri;

    // Mapping from token ID to ownership details
    // An empty struct value does not necessarily mean the token is unowned. See ownershipOf implementation for details.
    mapping(uint256 => TokenOwnership) internal _ownerships;

    mapping(address => bool) public whitelist;

    // Mapping owner address to address data
    mapping(address => AddressData) private _addressData;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    RateDistribute[] public feeDistributions;

    address public creator;

    uint256 public maxSupply;

    uint256 public maxMintAmount;

    uint256 public mintingPrice;

    uint256 public whitelistMintingPrice;

    uint256 public mintingEndTime;

    uint256 public mintingStartTime;

    uint16 public constant FIXED_POINT = 1000;

    uint16 public feeRate;

    bool public whitelistMode;

    bool public mintingFinished;

    modifier onlyCreator() {
        address sender = msg.sender;
        require(sender == creator || sender == owner(), "only creator");
        _;
    }

    constructor() {}

    function setBaseInfo(
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        uint256 _maxMintAmount,
        address _creator,
        string memory name_,
        string memory symbol_,
        string memory baseUri_
    ) external onlyOwner {
        require(_maxSupply > 0, "invalid maxSupply");
        require(_maxMintAmount < _maxSupply, "invalid maxMintAmount");
        require(_mintPrice > 0, "invalid minting price");
        require(
            _startTimestamp > block.timestamp,
            "startTimestamp before current time"
        );
        require(
            _endTimestamp > _startTimestamp,
            "endTimestamp before startTimestamp"
        );
        require(_creator != address(0), "zero creator address");

        maxMintAmount = _maxMintAmount;
        maxSupply = _maxSupply;
        mintingPrice = _mintPrice;
        whitelistMintingPrice = _mintPrice;
        mintingEndTime = _endTimestamp;
        mintingStartTime = _startTimestamp;
        _name = name_;
        _symbol = symbol_;
        _baseUri = baseUri_;
        whitelistMode = true;
        creator = _creator;

        whitelist[owner()] = true;
        whitelist[creator] = true;
    }

    function getTimestamp()
        external
        view
        returns (uint256 currentTime, uint256 endTime)
    {
        return (block.timestamp, mintingEndTime);
    }

    function getFeeDistributions()
        external
        view
        returns (RateDistribute[] memory)
    {
        return feeDistributions;
    }

    function setMaxMintAmount(uint256 _maxMintAmount) external onlyCreator {
        require(_maxMintAmount < maxSupply, "invalid maxMintAmount");
        maxMintAmount = _maxMintAmount;
    }

    function setBaseUri(string memory _uri) external onlyCreator {
        _baseUri = _uri;
    }

    function changeStartTime(uint256 _startTime) external onlyCreator {
        require(_startTime >= block.timestamp, "before current time");
        mintingStartTime = _startTime;
    }

    function changeEndTime(uint256 _endTime) external onlyCreator {
        require(_endTime > mintingStartTime, "before startTime");
        mintingEndTime = _endTime;
    }

    function enableWhitelistMode(bool _enable) external onlyCreator {
        whitelistMode = _enable;
    }

    function forceFinishMinting() external onlyCreator {
        maxSupply = totalSupply();
        mintingFinished = true;
    }

    function changeMaxTotalSupply(
        uint256 _maxTotalSupply
    ) external onlyCreator {
        require(
            totalSupply() <= _maxTotalSupply,
            "before current supplied amount"
        );
        maxSupply = _maxTotalSupply;
    }

    function setMultipleRecipients(
        address[] memory _recipients,
        uint16[] memory _weights
    ) external onlyCreator {
        uint256 length = _recipients.length;
        require(length > 0, "zero length array");
        require(length == _weights.length, "dismatch array");

        uint16 totalWeight = 0;
        for (uint256 i = 0; i < length; i++) {
            totalWeight += _weights[i];
            require(totalWeight <= FIXED_POINT, "invalid weights");
        }
        require(totalWeight == FIXED_POINT, "invalid weight");

        delete feeDistributions;
        for (uint256 i = 0; i < length; i++) {
            feeDistributions.push(RateDistribute(_recipients[i], _weights[i]));
        }
    }

    function mintAvailable() external view returns (bool) {
        if (mintingFinished) return false;
        uint256 curTime = block.timestamp;
        if (curTime < mintingStartTime) return false;
        if (curTime > mintingEndTime) return false;

        return true;
    }

    function setPriceForWhitelist(uint256 _price) external onlyCreator {
        whitelistMintingPrice = _price;
    }

    function setCollectionFeeRate(uint16 _feeRate) external onlyCreator {
        feeRate = _feeRate;
    }

    function setWhitelist(
        address[] memory _users,
        bool _isAdd
    ) external onlyCreator {
        uint256 length = _users.length;
        require(length > 0, "invalid array");

        for (uint256 i = 0; i < length; i++) {
            whitelist[_users[i]] = _isAdd;
        }
    }

    function mintNFTTo(
        address _recipient,
        uint256 _quantity
    ) external payable onlyOwner {
        _mintNFT(_recipient, _quantity);
    }

    function mintNFT(uint256 _quantity) external payable {
        _mintNFT(msg.sender, _quantity);
    }

    function _mintNFT(address _recipient, uint256 _quantity) internal {
        uint256 amount = msg.value;
        require(_quantity > 0, "zero quantity");
        require(_quantity <= maxMintAmount, "exceeds to maxMintAmount");
        require(_recipient != address(0), "zero recipient address");
        require(block.timestamp < mintingEndTime, "over minting time");
        require(totalSupply() + _quantity <= maxSupply, "over maxSupply");
        require(
            !whitelistMode || (whitelist[_recipient] || _recipient == owner()),
            "only whitelist"
        );

        uint256 requireAmount = mintingPrice * _quantity;
        if (!whitelistMode) {
            // if user is whitelisted, he can mint NFT before startTime.
            require(block.timestamp >= mintingStartTime, "before start time");
        } else {
            requireAmount = whitelistMintingPrice * _quantity;
        }

        require(
            _recipient == creator || amount >= requireAmount,
            "not enough cost"
        );

        uint256 restAmount = amount - requireAmount;
        /// refund rest ETH amount to minter.
        _transferETH(_recipient, restAmount);

        _distributeRewards(requireAmount);

        _safeMint(_recipient, _quantity);
    }

    function _distributeRewards(uint256 _amount) internal {
        uint256 length = feeDistributions.length;

        uint256 platFormFee = (_amount * feeRate) / FIXED_POINT;
        _amount -= platFormFee;
        _transferETH(owner(), platFormFee);

        if (length == 0) {
            _transferETH(creator, _amount);
            return;
        }

        for (uint256 i = 0; i < length; i++) {
            RateDistribute memory info = feeDistributions[i];
            if (i == length - 1) {
                _transferETH(info.recipient, address(this).balance);
            } else {
                uint256 transferAmount = (_amount * info.rate) / FIXED_POINT;
                _transferETH(info.recipient, transferAmount);
            }
        }
    }

    /**
     * @dev See {IERC721Enumerable-totalSupply}.
     */
    function totalSupply() public view returns (uint256) {
        // Counter underflow is impossible as _burnCounter cannot be incremented
        // more than _currentIndex times
        unchecked {
            return _currentIndex - _burnCounter;
        }
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function balanceOf(address _owner) public view override returns (uint256) {
        if (_owner == address(0)) revert BalanceQueryForZeroAddress();
        return uint256(_addressData[_owner].balance);
    }

    /**
     * Returns the number of tokens minted by `owner`.
     */
    function _numberMinted(address _owner) internal view returns (uint256) {
        if (_owner == address(0)) revert MintedQueryForZeroAddress();
        return uint256(_addressData[_owner].numberMinted);
    }

    /**
     * Returns the number of tokens burned by or on behalf of `owner`.
     */
    function _numberBurned(address _owner) internal view returns (uint256) {
        if (_owner == address(0)) revert BurnedQueryForZeroAddress();
        return uint256(_addressData[_owner].numberBurned);
    }

    /**
     * Returns the auxillary data for `owner`. (e.g. number of whitelist mint slots used).
     */
    function _getAux(address _owner) internal view returns (uint64) {
        if (_owner == address(0)) revert AuxQueryForZeroAddress();
        return _addressData[_owner].aux;
    }

    /**
     * Sets the auxillary data for `owner`. (e.g. number of whitelist mint slots used).
     * If there are multiple variables, please pack them into a uint64.
     */
    function _setAux(address _owner, uint64 aux) internal {
        if (_owner == address(0)) revert AuxQueryForZeroAddress();
        _addressData[_owner].aux = aux;
    }

    /**
     * Gas spent here starts off proportional to the maximum mint batch size.
     * It gradually moves to O(1) as tokens get transferred around in the collection over time.
     */
    function ownershipOf(
        uint256 tokenId
    ) internal view returns (TokenOwnership memory) {
        uint256 curr = tokenId;

        unchecked {
            if (curr < _currentIndex) {
                TokenOwnership memory ownership = _ownerships[curr];
                if (!ownership.burned) {
                    if (ownership.addr != address(0)) {
                        return ownership;
                    }
                    // Invariant:
                    // There will always be an ownership that has an address and is not burned
                    // before an ownership that does not have an address and is not burned.
                    // Hence, curr will not underflow.
                    while (true) {
                        curr--;
                        ownership = _ownerships[curr];
                        if (ownership.addr != address(0)) {
                            return ownership;
                        }
                    }
                }
            }
        }
        revert OwnerQueryForNonexistentToken();
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view override returns (address) {
        return ownershipOf(tokenId).addr;
    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length != 0
                ? string(abi.encodePacked(baseURI, tokenId.toString()))
                : "";
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overriden in child contracts.
     */
    function _baseURI() internal view virtual returns (string memory) {
        return _baseUri;
    }

    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address to, uint256 tokenId) public override {
        address _owner = ERC721A.ownerOf(tokenId);
        if (to == _owner) revert ApprovalToCurrentOwner();

        if (_msgSender() != _owner && !isApprovedForAll(_owner, _msgSender())) {
            revert ApprovalCallerNotOwnerNorApproved();
        }

        _approve(to, tokenId, _owner);
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(
        uint256 tokenId
    ) public view override returns (address) {
        if (!_exists(tokenId)) revert ApprovalQueryForNonexistentToken();

        return _tokenApprovals[tokenId];
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(
        address operator,
        bool approved
    ) public override {
        if (operator == _msgSender()) revert ApproveToCaller();

        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(
        address _owner,
        address operator
    ) public view virtual override returns (bool) {
        return _operatorApprovals[_owner][operator];
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        _transfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public virtual override {
        _transfer(from, to, tokenId);
        if (!_checkOnERC721Received(from, to, tokenId, _data)) {
            revert TransferToNonERC721ReceiverImplementer();
        }
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokenId < _currentIndex && !_ownerships[tokenId].burned;
    }

    function _safeMint(address to, uint256 quantity) internal {
        _safeMint(to, quantity, "");
    }

    /**
     * @dev Safely mints `quantity` tokens and transfers them to `to`.
     *
     * Requirements:
     *
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called for each safe transfer.
     * - `quantity` must be greater than 0.
     *
     * Emits a {Transfer} event.
     */
    function _safeMint(
        address to,
        uint256 quantity,
        bytes memory _data
    ) internal {
        _mint(to, quantity, _data, true);
    }

    /**
     * @dev Mints `quantity` tokens and transfers them to `to`.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `quantity` must be greater than 0.
     *
     * Emits a {Transfer} event.
     */
    function _mint(
        address to,
        uint256 quantity,
        bytes memory _data,
        bool safe
    ) internal {
        uint256 startTokenId = _currentIndex;
        if (to == address(0)) revert MintToZeroAddress();
        if (quantity == 0) revert MintZeroQuantity();

        _beforeTokenTransfers(address(0), to, startTokenId, quantity);

        // Overflows are incredibly unrealistic.
        // balance or numberMinted overflow if current value of either + quantity > 1.8e19 (2**64) - 1
        // updatedIndex overflows if _currentIndex + quantity > 1.2e77 (2**256) - 1
        unchecked {
            _addressData[to].balance += uint64(quantity);
            _addressData[to].numberMinted += uint64(quantity);

            _ownerships[startTokenId].addr = to;
            _ownerships[startTokenId].startTimestamp = uint64(block.timestamp);

            uint256 updatedIndex = startTokenId;

            for (uint256 i; i < quantity; i++) {
                emit Transfer(address(0), to, updatedIndex);
                if (
                    safe &&
                    !_checkOnERC721Received(address(0), to, updatedIndex, _data)
                ) {
                    revert TransferToNonERC721ReceiverImplementer();
                }
                updatedIndex++;
            }

            _currentIndex = updatedIndex;
        }
        _afterTokenTransfers(address(0), to, startTokenId, quantity);
    }

    /**
     * @dev Transfers `tokenId` from `from` to `to`.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(address from, address to, uint256 tokenId) private {
        TokenOwnership memory prevOwnership = ownershipOf(tokenId);

        bool isApprovedOrOwner = (_msgSender() == prevOwnership.addr ||
            isApprovedForAll(prevOwnership.addr, _msgSender()) ||
            getApproved(tokenId) == _msgSender());

        if (!isApprovedOrOwner) revert TransferCallerNotOwnerNorApproved();
        if (prevOwnership.addr != from) revert TransferFromIncorrectOwner();
        if (to == address(0)) revert TransferToZeroAddress();

        _beforeTokenTransfers(from, to, tokenId, 1);

        // Clear approvals from the previous owner
        _approve(address(0), tokenId, prevOwnership.addr);

        // Underflow of the sender's balance is impossible because we check for
        // ownership above and the recipient's balance can't realistically overflow.
        // Counter overflow is incredibly unrealistic as tokenId would have to be 2**256.
        unchecked {
            _addressData[from].balance -= 1;
            _addressData[to].balance += 1;

            _ownerships[tokenId].addr = to;
            _ownerships[tokenId].startTimestamp = uint64(block.timestamp);

            // If the ownership slot of tokenId+1 is not explicitly set, that means the transfer initiator owns it.
            // Set the slot of tokenId+1 explicitly in storage to maintain correctness for ownerOf(tokenId+1) calls.
            uint256 nextTokenId = tokenId + 1;
            if (_ownerships[nextTokenId].addr == address(0)) {
                // This will suffice for checking _exists(nextTokenId),
                // as a burned slot cannot contain the zero address.
                if (nextTokenId < _currentIndex) {
                    _ownerships[nextTokenId].addr = prevOwnership.addr;
                    _ownerships[nextTokenId].startTimestamp = prevOwnership
                        .startTimestamp;
                }
            }
        }

        emit Transfer(from, to, tokenId);
        _afterTokenTransfers(from, to, tokenId, 1);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal virtual {
        TokenOwnership memory prevOwnership = ownershipOf(tokenId);

        _beforeTokenTransfers(prevOwnership.addr, address(0), tokenId, 1);

        // Clear approvals from the previous owner
        _approve(address(0), tokenId, prevOwnership.addr);

        // Underflow of the sender's balance is impossible because we check for
        // ownership above and the recipient's balance can't realistically overflow.
        // Counter overflow is incredibly unrealistic as tokenId would have to be 2**256.
        unchecked {
            _addressData[prevOwnership.addr].balance -= 1;
            _addressData[prevOwnership.addr].numberBurned += 1;

            // Keep track of who burned the token, and the timestamp of burning.
            _ownerships[tokenId].addr = prevOwnership.addr;
            _ownerships[tokenId].startTimestamp = uint64(block.timestamp);
            _ownerships[tokenId].burned = true;

            // If the ownership slot of tokenId+1 is not explicitly set, that means the burn initiator owns it.
            // Set the slot of tokenId+1 explicitly in storage to maintain correctness for ownerOf(tokenId+1) calls.
            uint256 nextTokenId = tokenId + 1;
            if (_ownerships[nextTokenId].addr == address(0)) {
                // This will suffice for checking _exists(nextTokenId),
                // as a burned slot cannot contain the zero address.
                if (nextTokenId < _currentIndex) {
                    _ownerships[nextTokenId].addr = prevOwnership.addr;
                    _ownerships[nextTokenId].startTimestamp = prevOwnership
                        .startTimestamp;
                }
            }
        }

        emit Transfer(prevOwnership.addr, address(0), tokenId);
        _afterTokenTransfers(prevOwnership.addr, address(0), tokenId, 1);

        // Overflow not possible, as _burnCounter cannot be exceed _currentIndex times.
        unchecked {
            _burnCounter++;
        }
    }

    /**
     * @dev Approve `to` to operate on `tokenId`
     *
     * Emits a {Approval} event.
     */
    function _approve(address to, uint256 tokenId, address _owner) private {
        _tokenApprovals[tokenId] = to;
        emit Approval(_owner, to, tokenId);
    }

    /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * @param _data bytes optional data to send along with the call
     * @return bool whether the call correctly returned the expected magic value
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (to.isContract()) {
            try
                IERC721Receiver(to).onERC721Received(
                    _msgSender(),
                    from,
                    tokenId,
                    _data
                )
            returns (bytes4 retval) {
                return retval == IERC721Receiver(to).onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert TransferToNonERC721ReceiverImplementer();
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    /**
     * @dev Hook that is called before a set of serially-ordered token ids are about to be transferred. This includes minting.
     * And also called before burning one token.
     *
     * startTokenId - the first token id to be transferred
     * quantity - the amount to be transferred
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, `from`'s `tokenId` will be
     * transferred to `to`.
     * - When `from` is zero, `tokenId` will be minted for `to`.
     * - When `to` is zero, `tokenId` will be burned by `from`.
     * - `from` and `to` are never both zero.
     */
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual {}

    /**
     * @dev Hook that is called after a set of serially-ordered token ids have been transferred. This includes
     * minting.
     * And also called after one token has been burned.
     *
     * startTokenId - the first token id to be transferred
     * quantity - the amount to be transferred
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, `from`'s `tokenId` has been
     * transferred to `to`.
     * - When `from` is zero, `tokenId` has been minted for `to`.
     * - When `to` is zero, `tokenId` has been burned by `from`.
     * - `from` and `to` are never both zero.
     */
    function _afterTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual {}

    function _transferETH(address _recipient, uint256 _amount) internal {
        if (_amount == 0) {
            return;
        }
        (bool sent, ) = _recipient.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }
}
