// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract NFTMarket is ERC721URIStorage, Ownable {
    //////////  Error   /////////
    error NFTMarket__PriceMustBeGreaterThanZero();
    error NFTMarket__ThisNFTIsNotListedForSale();
    error NFTMarket__IncorrectPrice();
    error NFTMarket__YouAreNotTheSeller();
    error NFTMarket__CanNotWithdrawWithZeroBalance();

    //////////  Struct   /////////
    struct NFTListing {
        uint256 price;
        address seller;
    }

    //////////  Variable   /////////
    uint256 private i_tokenId = 0;
    mapping(uint256 tokenId => NFTListing) private _listings;

    uint256 private constant SERVICE_ERAN = 95;
    uint256 private constant SERVICE_PRECISION = 100;

    //////////    Event    /////////
    // if tokenURI is not an empty string => an NFT was created
    // if price is not 0 => an NFT was listed
    // if price is 0 && tokenURI is an empty string => NFT was transferred (either bought, or the listing was canceled)
    event NFTTransfer(
        uint256 tokenID,
        address from,
        address to,
        string tokenURI,
        uint256 price
    );

    ///////// constructor /////////
    constructor(
        address initialOwner
    ) ERC721("Kitten", "CAT") Ownable(initialOwner) {}

    /**
     * This function is use to mint a new NFT by person who call this function.
     * @param tokenURI NFT tokenUIR on IPFS
     */
    function createNFT(string calldata tokenURI) public {
        i_tokenId++;
        _safeMint(msg.sender, i_tokenId);
        _setTokenURI(i_tokenId, tokenURI);
        emit NFTTransfer(i_tokenId, address(0), msg.sender, tokenURI, 0);
    }

    /**
     * The person with the NFT invokes this function for the item listing activity.
     * @param tokenID Unique identification of non-homogeneous tokens
     * @param price  The price of this NfT, Bind by tokenId
     */
    function listNFT(uint256 tokenID, uint256 price) public {
        //require(price > 0, "NFTMarket: price must be greater than 0");
        if (price <= 0) {
            revert NFTMarket__PriceMustBeGreaterThanZero(); // less gas
        }
        transferFrom(msg.sender, address(this), tokenID);
        _listings[tokenID] = NFTListing(price, msg.sender);
        emit NFTTransfer(tokenID, msg.sender, address(this), "", price);
    }

    /**
     * @notice follows CEI: Check, Effects, Interactions
     * 1. Verify that the NFT is on the shelf and that the buyer paid an amount equal to the listed price.
     * 2. Transfer the NFT from the market contract address to the buyer.
     * 3. Clear listing information from the market.
     * 4. 95% of the amount paid is transferred to the seller (5% is retained as a fee).
     * 5. The NFTTransfer event is triggered to notify the front-end that the NFT has been purchased.
     *
     * @param tokenID Unique identification of non-homogeneous tokens
     */
    function buyNFT(uint256 tokenID) public payable {
        NFTListing memory listing = _listings[tokenID];
        //require(listing.price > 0, "NFTMarket: nft not listed for sale");
        //require(msg.value == listing.price, "NFTMarket: incorrect price");
        if (listing.price <= 0) {
            revert NFTMarket__ThisNFTIsNotListedForSale(); //less gas
        }
        if (msg.value != listing.price) {
            revert NFTMarket__IncorrectPrice(); //less gas
        }
        ERC721(address(this)).transferFrom(address(this), msg.sender, tokenID);
        clearListing(tokenID);
        // The platform charges a 5% commission
        payable(listing.seller).transfer(
            (listing.price * SERVICE_ERAN) / SERVICE_PRECISION
        );
        emit NFTTransfer(tokenID, address(this), msg.sender, "", 0);
    }

    /**
     * @notice follows CEI: Check, Effects, Interactions
     * Verify that the NFT is listed and that the caller is the seller of the NFT.
     * Transfer the NFT from the market contract back to the seller.
     * Clear listing information from the market.
     * Triggers an NFTTransfer event, notifying the front-end that the NFT has been canceled.
     *
     * @param tokenID Unique identification of non-homogeneous tokens
     */
    function cancelListing(uint256 tokenID) public {
        NFTListing memory listing = _listings[tokenID];
        //require(listing.price > 0, "NFTMarket: nft not listed for sale");
        //require( listing.seller == msg.sender, "NFTMarket: you're not the seller");
        if (listing.price <= 0) {
            revert NFTMarket__ThisNFTIsNotListedForSale(); //less gas
        }
        if (listing.seller != msg.sender) {
            revert NFTMarket__YouAreNotTheSeller();
        }
        ERC721(address(this)).transferFrom(address(this), msg.sender, tokenID);
        clearListing(tokenID);
        emit NFTTransfer(tokenID, address(this), msg.sender, "", 0);
    }

    /**
     * Only the contract owner can call this function.
     * Verify that the balance in the market contract is greater than 0.
     * Transfer all funds in the contract to the contract owner.
     */
    function withdrawFunds() public onlyOwner {
        uint256 balance = address(this).balance;
        //require(balance > 0, "NFTMarket: balance is zero");
        if (balance <= 0) {
            revert NFTMarket__CanNotWithdrawWithZeroBalance();
        }
        payable(msg.sender).transfer(balance);
    }

    /**
     * Clear listing information.
     * Set the price corresponding to the tokenID to 0 and the seller address to zero address.
     * This means that the NFT is no longer available for sale.
     * @param tokenID Unique identification of non-homogeneous tokens
     */
    function clearListing(uint256 tokenID) private {
        _listings[tokenID].price = 0;
        _listings[tokenID].seller = address(0);
    }
}
