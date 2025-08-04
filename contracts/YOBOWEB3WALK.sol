// SPDX-License-Identifier: MIT

/**
 * @title MIT License
 * @copyright 2024 Hiroshi Tanimoto / Sense It Smart Corporation
 * 
 * @notice Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * @notice The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * @notice THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * @notice This project uses OpenZeppelin Contracts (https://github.com/OpenZeppelin/openzeppelin-contracts)
 * which is licensed under the MIT License.
 * 
 * @notice IMPORTANT: This software may be subject to patent rights. Your use of this software may be subject 
 * to additional terms and conditions as outlined in our Patent Policy. Please refer to our Patent 
 * Policy for more information:
 * Patent Policy: https://espl.jp/patentpolicy/
 */

pragma solidity ^0.8.16;

import "./ERC721.sol";
import "./Ownable.sol";
import "./Strings.sol";
import "./Counters.sol";
import "./EnumerableSet.sol";

/**
 * @title YOBOWEB3WALK - YOBO web3 Walk Soul Bound Token
 * @dev ERC721-based Soul Bound Token for YOBO web3 Walk participants
 * @dev Participants receive SBT automatically upon completing 7-day walking challenge
 * @dev Tokens cannot be transferred between addresses except by admins for emergency purposes
 * @dev Contract address: 0xbF3cc82d768EDE2DABf8f61E0029F6d0A80f1Ca0 (Polygon Network)
 */
contract YOBOWEB3WALK is ERC721, Ownable {
    using Strings for uint256;
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.AddressSet;
    
    Counters.Counter private _tokenIdCounter;
    
    // YOBO web3 Walk specific constants
    uint256 public constant MAX_SUPPLY = 201; // Total supply: 0-200 (201 tokens)
    
    // URI and metadata settings
    string public baseURI;
    string public baseExtension = ".json";
    
    // Admin management system
    EnumerableSet.AddressSet private admins;
    bool private transferEnabled = false; // Soul Bound: transfers disabled by default
    
    // Events
    event TransferStatusChanged(bool enabled);
    event SoulBoundMint(address indexed to, uint256 indexed tokenId);
    event ChallengeCompleted(address indexed participant, uint256 indexed tokenId);
    
    modifier onlyAdmin() {
        require(admins.contains(_msgSender()), "Only admins can call this function");
        _;
    }

    /**
     * @dev Constructor - Initializes YOBO web3 Walk SBT contract
     * @param _initBaseURI Base URI for token metadata (IPFS hash)
     */
    constructor(
        string memory _initBaseURI
    ) ERC721("YOBOWEB3WALK", "YOB3WK") {
        setBaseURI(_initBaseURI);
        admins.add(msg.sender); // Contract deployer becomes first admin
        
        // Mint Genesis SBT (#0) to contract owner (JPMA)
        uint256 genesisTokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, genesisTokenId);
        
        emit SoulBoundMint(msg.sender, genesisTokenId);
    }

    /**
     * @dev Returns the base URI for token metadata
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    /**
     * @dev Override supportsInterface to include Soul Bound Token detection
     * @param interfaceId Interface identifier to check
     * @return bool Whether the interface is supported
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return 
            interfaceId == 0x49064906 || // Soul Bound Token interface
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev YOBO web3 Walk: Automatic SBT minting upon challenge completion
     * @param participant Address of the participant who completed the 7-day walking challenge
     * @notice This function is called automatically when walking challenge is completed
     * @notice Each participant can only receive one SBT
     */
    function recordChallengeAndMint(address participant) 
        external 
        onlyAdmin
    {
        require(participant != address(0), "Invalid participant address");
        require(balanceOf(participant) == 0, "Participant already has SBT");
        require(_tokenIdCounter.current() < MAX_SUPPLY, "Exceeds max supply");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(participant, tokenId);
        
        emit SoulBoundMint(participant, tokenId);
        emit ChallengeCompleted(participant, tokenId);
    }

    /**
     * @dev Manual SBT minting by admin (for emergency cases)
     * @param to Recipient address
     * @notice Used for emergency situations like system failures
     */
    function safeMint(address to) public onlyAdmin {
        require(to != address(0), "Invalid address");
        require(_tokenIdCounter.current() < MAX_SUPPLY, "Exceeds max supply");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        
        emit SoulBoundMint(to, tokenId);
    }

    /**
     * @dev Batch minting for multiple recipients (emergency use)
     * @param recipients Array of recipient addresses
     * @notice Used when system failures affect multiple participants
     * @notice More gas efficient than individual minting for bulk operations
     */
    function batchMint(address[] calldata recipients) public onlyAdmin {
        require(_tokenIdCounter.current() + recipients.length <= MAX_SUPPLY, "Exceeds max supply");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            address to = recipients[i];
            require(to != address(0), "Invalid address in batch");
            
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(to, tokenId);
            
            emit SoulBoundMint(to, tokenId);
        }
    }

    // === VIEW FUNCTIONS ===

    /**
     * @dev Returns the next token ID to be minted
     */
    function nextTokenIdToMint() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Returns total number of minted tokens
     */
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @dev Returns remaining supply available for minting
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - _tokenIdCounter.current();
    }

    /**
     * @dev Get token ID owned by a specific address
     * @param owner Token owner address
     * @return tokenId Token ID owned by the address
     * @notice Each participant owns maximum one SBT
     */
    function getTokenIdByOwner(address owner) external view returns (uint256) {
        require(balanceOf(owner) > 0, "No SBT owned");
        
        // Simple implementation: find first token owned by address
        // Since each participant owns max 1 token, this is sufficient
        for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
            if (_exists(i) && ownerOf(i) == owner) {
                return i;
            }
        }
        revert("Token not found"); // Should never reach here
    }

    /**
     * @dev Check if participant owns an SBT
     * @param participant Participant address to check
     * @return bool True if participant owns SBT, false otherwise
     */
    function hasSBT(address participant) external view returns (bool) {
        return balanceOf(participant) > 0;
    }

    /**
     * @dev Returns token URI with 3-digit zero padding
     * @param tokenId Token ID to get URI for
     * @return string Token URI (e.g., "ipfs://hash/001.json")
     */
    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        string memory currentBaseURI = _baseURI();
        return
            bytes(currentBaseURI).length > 0
                ? string(
                    abi.encodePacked(
                        currentBaseURI,
                        _toString(tokenId),
                        baseExtension
                    )
                )
                : "";
    }

    /**
     * @dev Helper function for 3-digit zero padding
     * @param value Number to convert
     * @return string Zero-padded string (e.g., 1 -> "001", 42 -> "042")
     * @notice Ensures consistent file naming: 000.json, 001.json, ..., 200.json
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "000";
        }
        
        // 3-digit zero padding
        if (value < 10) {
            return string(abi.encodePacked("00", value.toString()));
        } else if (value < 100) {
            return string(abi.encodePacked("0", value.toString()));
        } else {
            return value.toString();
        }
    }

    // === ADMIN FUNCTIONS ===

    /**
     * @dev Set base URI for token metadata
     * @param _newBaseURI New base URI (IPFS hash)
     */
    function setBaseURI(string memory _newBaseURI) public onlyOwner {
        baseURI = _newBaseURI;
    }

    /**
     * @dev Set file extension for token metadata
     * @param _newBaseExtension New file extension (default: ".json")
     */
    function setBaseExtension(
        string memory _newBaseExtension
    ) public onlyOwner {
        baseExtension = _newBaseExtension;
    }

    /**
     * @dev Add or remove admin privileges
     * @param _adminAddr Address to modify
     * @param _flag True to add admin, false to remove
     * @notice Cannot remove the last remaining admin
     */
    function updateAdmin(address _adminAddr, bool _flag) external onlyAdmin {
        require(_adminAddr != address(0), "UpdateAdmin: Invalid address");
        if (_flag) {
            admins.add(_adminAddr);
        } else {
            require(admins.length() > 1, "UpdateAdmin: Cannot remove last admin");
            admins.remove(_adminAddr);
        }
    }

    /**
     * @dev Get list of all admin addresses
     * @return address[] Array of admin addresses
     */
    function getAdmins() external view returns (address[] memory) {
        return admins.values();
    }

    // === SOUL BOUND TOKEN IMPLEMENTATION ===

    /**
     * @dev Hook called before token transfer - implements Soul Bound logic
     * @param from Sender address (zero for minting)
     * @param to Recipient address (zero for burning)
     * @param tokenId Token ID being transferred
     * @notice Prevents transfers unless done by admin or emergency mode enabled
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);
        
        bool isMint = from == address(0);
        bool isBurn = to == address(0);
        bool isAdminOperation = admins.contains(_msgSender()) || admins.contains(from);
        
        require(
            isMint ||           // Minting is allowed
            isBurn ||           // Burning is allowed
            isAdminOperation || // Admin operations are allowed
            transferEnabled,    // Emergency transfer mode is enabled
            "Soul Bound Token: Transfers are disabled"
        );
    }
    
    /**
     * @dev Override transferFrom to prevent transfers
     * @notice Only admins or emergency mode can transfer tokens
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        super.transferFrom(from, to, tokenId);
    }
    
    /**
     * @dev Override safeTransferFrom to prevent transfers
     * @notice Only admins or emergency mode can transfer tokens
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        super.safeTransferFrom(from, to, tokenId);
    }
    
    /**
     * @dev Override safeTransferFrom with data to prevent transfers
     * @notice Only admins or emergency mode can transfer tokens
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public virtual override {
        super.safeTransferFrom(from, to, tokenId, data);
    }
    
    /**
     * @dev Emergency function to enable/disable transfers (admin only)
     * @param _enabled Whether to enable or disable transfers
     * @notice Should only be used in extreme emergency situations
     */
    function setTransferEnabled(bool _enabled) external onlyAdmin {
        bool previousState = transferEnabled;
        transferEnabled = _enabled;
        
        if (previousState != _enabled) {
            emit TransferStatusChanged(_enabled);
        }
    }
    
    /**
     * @dev Check if token is soul bound (non-transferable)
     * @return bool Returns true if token is soul bound (transfers disabled)
     */
    function isSoulBound() external view returns (bool) {
        return !transferEnabled;
    }
}