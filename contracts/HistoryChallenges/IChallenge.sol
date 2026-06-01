// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

interface IChallenge {
    /**
     * @dev Returns the goal of the challenge.
     */
    function goal() external view returns(uint256);

    /**
     * @dev Returns the duration of the challenge.
     */
    function duration() external view returns(uint256);

    /**
     * @dev Returns the number of days required to complete the challenge.
     */
    function dayRequired() external view returns(uint256);

    /**
     * @dev Returns the total balance of the base token.
     */
    function totalReward() external view returns(uint256);

    /**
     * @dev Returns the balance of the token.
     */
    function getBalanceToken() external view returns(uint256[] memory);

    /**
     * @dev Returns whether giving up is allowed for the specified index.
     */
    function allowGiveUp(uint256 _index) external view returns(bool);

    /**
     * @dev Returns the address of the donation wallet.
     */
    function donationWalletAddress() external view returns(address);

    /**
     * @dev Returns the address of the returned NFT wallet.
     */
    function returnedNFTWallet() external view returns(address);

    /**
     * @dev Returns the array of award receivers' percentages.
     */
    function getAwardReceiversPercent() external view returns(uint256[] memory);

    /**
     * @dev Returns the challenger's address.
     */
    function challenger() external view returns(address);
    
    /**
     * @dev Returns the sponsor's address.
     */
    function sponsor() external view returns(address);

    /**
     * @dev Returns the award receiver's address at the specified index.
     * @param _index The index of the award receiver.
     * @param _isAddressSuccess Whether the address retrieval is successful.
     */
    function getAwardReceiversAtIndex(uint256 _index, bool _isAddressSuccess) external view returns(address);

    /**
     * @dev Returns whether the challenge is finished.
     */
    function isFinished() external view returns(bool);
     
    /**
     * @dev Returns whether the challenge is success.
     */
    function isSuccess() external view returns(bool);

    /**
     * @dev Returns the address of the ERC721 token at the specified index.
     * @param _index The index of the ERC721 token.
     */
    function erc721Address(uint256 _index) external view returns(address);

    /**
     * @dev Returns the start time of the contract.
     * @return The start time as a uint256 value.
     */
    function startTime() external view returns(uint256);

    /**
     * @dev Returns the end time of the contract.
     * @return The end time as a uint256 value.
     */
    function endTime() external view returns(uint256);

    /**
     * @dev Returns an array of addresses representing all ERC20 contracts associated with this contract.
     * @return An array of addresses.
     */
    function allContractERC20() external view returns(address[] memory);

    /**
     * @dev Returns the index of the NFT (non-fungible token) associated with this contract.
     * @return The index as a uint256 value.
     */
    function indexNft() external view returns(uint256);

    /**
     * @dev Returns the address that created this contract.
     * @return The creator's address.
     */
    function createByToken() external view returns(address);

    /**
     * @dev Returns the balance of the contract in the base token.
     * @return The contract balance as a uint256 value.
     */
    function getContractBalance() external view returns(uint256);

    /**
     * @dev Returns the total balance of the base token in the contract.
     * @return The total balance of the base token as a uint256 value.
     */
    function totalBalanceBaseToken() external view returns(uint256);
}
