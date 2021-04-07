pragma solidity ^0.6.0;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IBEP20.sol";

contract LightningProtocol is Context, IBEP20, Ownable {

    struct Transaction {
        bool enabled;
        address destination;
        bytes data;
    }

    // Stable ordering is not guaranteed.
    Transaction[] public transactions;

    using SafeMath for uint256;
    using Address for address;

    mapping (address => uint256) private _rOwned;
    mapping (address => uint256) private _tOwned;
    mapping (address => mapping (address => uint256)) private _allowances;

    mapping (address => bool) private _isExcluded;
    address[] private _excluded;
    
    string  private constant _NAME = 'Lightning';
    string  private constant _SYMBOL = 'LIGHT';
    uint8   private constant _DECIMALS = 8;
   
    uint256 private constant _MAX = ~uint256(0);
    uint256 private constant _DECIMALFACTOR = 10 ** uint256(_DECIMALS);
    uint256 private constant _GRANULARITY = 100;
    
    uint256 private _tTotal = 100000000 * _DECIMALFACTOR;
    uint256 private _rTotal = (_MAX - (_MAX % _tTotal));
    
    uint256 private _tFeeTotal;
    uint256 private _tBurnTotal;
    uint256 private _lightningCycle = 0;

    uint256 private _tTradeCycle = 0;
    uint256 private _tBurnCycle = 0;
    
    uint256 private transferredTokens = 0;
    uint256 private tokenBatchCount = 0;
    uint256 private     _BURN_FEE = 0;
    uint256 private     _TAX_FEE = 0;
    uint256 private constant _MAX_TX_SIZE = 100000000 * _DECIMALFACTOR;

    // TOTAL_GONS is a multiple of INITIAL_FRAGMENTS_SUPPLY so that _gonsPerFragment is an integer.
    // Use the highest value that fits in a uint256 for max granularity.

    // MAX_SUPPLY = maximum integer < (sqrt(4*TOTAL_GONS + 1) - 1) / 2
    uint256 private constant MAX_SUPPLY = ~uint128(0);  // (2^128) - 1  

    uint256 private _gonsPerFragment;
    mapping(address => uint256) private _gonBalances;

    
    constructor () public {
        _rOwned[_msgSender()] = _rTotal;
        emit Transfer(address(0), _msgSender(), _tTotal);
    }


    event TransactionFailed(address indexed destination, uint index, bytes data);

    function name() public view returns (string memory) {
        return _NAME;
    }

    function symbol() public view returns (string memory) {
        return _SYMBOL;
    }

    function decimals() public view returns (uint8) {
        return _DECIMALS;
    }

    function totalSupply() public view override returns (uint256) {
        return _tTotal;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (_isExcluded[account]) return _tOwned[account];
        return tokenFromReflection(_rOwned[account]);
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, _msgSender(), _allowances[sender][_msgSender()].sub(amount, "BEP20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].sub(subtractedValue, "BEP20: decreased allowance below zero"));
        return true;
    }

    function isExcluded(address account) public view returns (bool) {
        return _isExcluded[account];
    }

    function totalFees() public view returns (uint256) {
        return _tFeeTotal;
    }
    
    function totalBurn() public view returns (uint256) {
        return _tBurnTotal;
    }

    function deliver(uint256 tAmount) public {
        address sender = _msgSender();
        require(!_isExcluded[sender], "Excluded addresses cannot call this function");
        (uint256 rAmount,,,,,) = _getValues(tAmount);
        _rOwned[sender] = _rOwned[sender].sub(rAmount);
        _rTotal = _rTotal.sub(rAmount);
        _tFeeTotal = _tFeeTotal.add(tAmount);
    }

    function reflectionFromToken(uint256 tAmount, bool deductTransferFee) public view returns(uint256) {
        require(tAmount <= _tTotal, "Amount must be less than supply");
        if (!deductTransferFee) {
            (uint256 rAmount,,,,,) = _getValues(tAmount);
            return rAmount;
        } else {
            (,uint256 rTransferAmount,,,,) = _getValues(tAmount);
            return rTransferAmount;
        }
    }

    function tokenFromReflection(uint256 rAmount) public view returns(uint256) {
        require(rAmount <= _rTotal, "Amount must be less than total reflections");
        uint256 currentRate =  _getRate();
        return rAmount.div(currentRate);
    }

    function excludeAccount(address account) external onlyOwner() {
        require(account != 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, 'We can not exclude Uniswap router.');
        require(!_isExcluded[account], "Account is already excluded");
        if(_rOwned[account] > 0) {
            _tOwned[account] = tokenFromReflection(_rOwned[account]);
        }
        _isExcluded[account] = true;
        _excluded.push(account);
    }

    function includeAccount(address account) external onlyOwner() {
        require(_isExcluded[account], "Account is already excluded");
        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_excluded[i] == account) {
                _excluded[i] = _excluded[_excluded.length - 1];
                _tOwned[account] = 0;
                _isExcluded[account] = false;
                _excluded.pop();
                break;
            }
        }
    }

    function _approve(address owner, address spender, uint256 amount) private {
        require(owner != address(0), "BEP20: approve from the zero address");
        require(spender != address(0), "BEP20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) private {
        require(sender != address(0), "BEP20: transfer from the zero address");
        require(recipient != address(0), "BEP20: transfer to the zero address");
        require(amount > 0, "Transfer amount must be greater than zero");
    
        // @dev once all cycles are completed, burn fee will be set to 0 and the protocol 
        // reaches its final phase, in which no further supply elasticity will take place
        // and fees will stay at 0 
        
        if(sender != owner() && recipient != owner())
            require(amount <= _MAX_TX_SIZE, "Transfer amount exceeds the maxTxAmount.");

        if(_BURN_FEE >= 500){
        
        _tTradeCycle = _tTradeCycle.add(amount);


        // @dev adjust current burnFee depending on the traded tokens during th

            if(_tTradeCycle >= (0 * _DECIMALFACTOR) && _tTradeCycle <= (999999*_DECIMALFACTOR)){
                _setBurnFee(500);
            } else if(_tTradeCycle >= (1000000 * _DECIMALFACTOR) && _tTradeCycle <= (2000000 * _DECIMALFACTOR)){
                _setBurnFee(550);
            }   else if(_tTradeCycle >= (2000000 * _DECIMALFACTOR) && _tTradeCycle <= (3000000 * _DECIMALFACTOR)){
                _setBurnFee(600);
            }   else if(_tTradeCycle >= (3000000 * _DECIMALFACTOR) && _tTradeCycle <= (4000000 * _DECIMALFACTOR)){
                _setBurnFee(650);
            } else if(_tTradeCycle >= (4000000 * _DECIMALFACTOR) && _tTradeCycle <= (5000000 * _DECIMALFACTOR)){
                _setBurnFee(700);
            } else if(_tTradeCycle >= (5000000 * _DECIMALFACTOR) && _tTradeCycle <= (6000000 * _DECIMALFACTOR)){
                _setBurnFee(750);
            } else if(_tTradeCycle >= (6000000 * _DECIMALFACTOR) && _tTradeCycle <= (7000000 * _DECIMALFACTOR)){
                _setBurnFee(800);
            } else if(_tTradeCycle >= (7000000 * _DECIMALFACTOR) && _tTradeCycle <= (8000000 * _DECIMALFACTOR)){
                _setBurnFee(850);
            } else if(_tTradeCycle >= (8000000 * _DECIMALFACTOR) && _tTradeCycle <= (9000000 * _DECIMALFACTOR)){
                _setBurnFee(900);
            } else if(_tTradeCycle >= (9000000 * _DECIMALFACTOR) && _tTradeCycle <= (10000000 * _DECIMALFACTOR)){
                _setBurnFee(950);
            } else if(_tTradeCycle >= (10000000 * _DECIMALFACTOR) && _tTradeCycle <= (11000000 * _DECIMALFACTOR)){
                _setBurnFee(1000);
            } else if(_tTradeCycle >= (11000000 * _DECIMALFACTOR) && _tTradeCycle <= (12000000 * _DECIMALFACTOR)){
                _setBurnFee(1050);
            } else if(_tTradeCycle >= (12000000 * _DECIMALFACTOR) && _tTradeCycle <= (13000000 * _DECIMALFACTOR)){
                _setBurnFee(1100);
            } else if(_tTradeCycle >= (13000000 * _DECIMALFACTOR) && _tTradeCycle <= (14000000 * _DECIMALFACTOR)){
                _setBurnFee(1150);
            } else if(_tTradeCycle >= (14000000 * _DECIMALFACTOR)){
                _setBurnFee(1200);
            }
            
        }

        
        
        
        if (_isExcluded[sender] && !_isExcluded[recipient]) {
            _transferFromExcluded(sender, recipient, amount);
        } else if (!_isExcluded[sender] && _isExcluded[recipient]) {
            _transferToExcluded(sender, recipient, amount);
        } else if (!_isExcluded[sender] && !_isExcluded[recipient]) {
            _transferStandard(sender, recipient, amount);
        } else if (_isExcluded[sender] && _isExcluded[recipient]) {
            _transferBothExcluded(sender, recipient, amount);
        } else {
            _transferStandard(sender, recipient, amount);
        }
    }

    function _transferStandard(address sender, address recipient, uint256 tAmount) private {
        uint256 currentRate =  _getRate();
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee, uint256 tBurn) = _getValues(tAmount);
        uint256 rBurn =  tBurn.mul(currentRate);
        _rOwned[sender] = _rOwned[sender].sub(rAmount);
        _rOwned[recipient] = _rOwned[recipient].add(rTransferAmount);       
        _burnAndRebase(rFee, rBurn, tFee, tBurn);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _transferToExcluded(address sender, address recipient, uint256 tAmount) private {
        uint256 currentRate =  _getRate();
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee, uint256 tBurn) = _getValues(tAmount);
        uint256 rBurn =  tBurn.mul(currentRate);
        _rOwned[sender] = _rOwned[sender].sub(rAmount);
        _tOwned[recipient] = _tOwned[recipient].add(tTransferAmount);
        _rOwned[recipient] = _rOwned[recipient].add(rTransferAmount);           
        _burnAndRebase(rFee, rBurn, tFee, tBurn);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _transferFromExcluded(address sender, address recipient, uint256 tAmount) private {
        uint256 currentRate =  _getRate();
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee, uint256 tBurn) = _getValues(tAmount);
        uint256 rBurn =  tBurn.mul(currentRate);
        _tOwned[sender] = _tOwned[sender].sub(tAmount);
        _rOwned[sender] = _rOwned[sender].sub(rAmount);
        _rOwned[recipient] = _rOwned[recipient].add(rTransferAmount);   
        _burnAndRebase(rFee, rBurn, tFee, tBurn);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _transferBothExcluded(address sender, address recipient, uint256 tAmount) private {
        uint256 currentRate =  _getRate();
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee, uint256 tBurn) = _getValues(tAmount);
        uint256 rBurn =  tBurn.mul(currentRate);
        _tOwned[sender] = _tOwned[sender].sub(tAmount);
        _rOwned[sender] = _rOwned[sender].sub(rAmount);
        _tOwned[recipient] = _tOwned[recipient].add(tTransferAmount);
        _rOwned[recipient] = _rOwned[recipient].add(rTransferAmount);        
        _burnAndRebase(rFee, rBurn, tFee, tBurn);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _burnAndRebase(uint256 rFee, uint256 rBurn, uint256 tFee, uint256 tBurn) private {
        _rTotal = _rTotal.sub(rFee).sub(rBurn);
        _tFeeTotal = _tFeeTotal.add(tFee);
        _tBurnTotal = _tBurnTotal.add(tBurn);
        _tBurnCycle = _tBurnCycle.add(tBurn);
        _tTotal = _tTotal.sub(tBurn);


        // @dev after 1,275,000 tokens burnt, supply is expanded by 637,500 tokens 
        if(_tBurnCycle >= (1275000 * _DECIMALFACTOR)){
                uint256 _tRebaseDelta = 637500 * _DECIMALFACTOR;
                _tBurnCycle = _tBurnCycle.sub((1275000 * _DECIMALFACTOR));
                _tTradeCycle = 0;
                _setBurnFee(500);

                _rebase(_tRebaseDelta);
            } 
    }

    function _getValues(uint256 tAmount) private view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        (uint256 tTransferAmount, uint256 tFee, uint256 tBurn) = _getTValues(tAmount, _TAX_FEE, _BURN_FEE);
        uint256 currentRate =  _getRate();
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee) = _getRValues(tAmount, tFee, tBurn, currentRate);
        return (rAmount, rTransferAmount, rFee, tTransferAmount, tFee, tBurn);
    }

    function _getTValues(uint256 tAmount, uint256 taxFee, uint256 burnFee) private pure returns (uint256, uint256, uint256) {
        uint256 tFee = ((tAmount.mul(taxFee)).div(_GRANULARITY)).div(100);
        uint256 tBurn = ((tAmount.mul(burnFee)).div(_GRANULARITY)).div(100);
        uint256 tTransferAmount = tAmount.sub(tFee).sub(tBurn);
        return (tTransferAmount, tFee, tBurn);
    }

    function _getRValues(uint256 tAmount, uint256 tFee, uint256 tBurn, uint256 currentRate) private pure returns (uint256, uint256, uint256) {
        uint256 rAmount = tAmount.mul(currentRate);
        uint256 rFee = tFee.mul(currentRate);
        uint256 rBurn = tBurn.mul(currentRate);
        uint256 rTransferAmount = rAmount.sub(rFee).sub(rBurn);
        return (rAmount, rTransferAmount, rFee);
    }

    function _getRate() private view returns(uint256) {
        (uint256 rSupply, uint256 tSupply) = _getCurrentSupply();
        return rSupply.div(tSupply);
    }

    function _getCurrentSupply() private view returns(uint256, uint256) {
        uint256 rSupply = _rTotal;
        uint256 tSupply = _tTotal;      
        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_rOwned[_excluded[i]] > rSupply || _tOwned[_excluded[i]] > tSupply) return (_rTotal, _tTotal);
            rSupply = rSupply.sub(_rOwned[_excluded[i]]);
            tSupply = tSupply.sub(_tOwned[_excluded[i]]);
        }
        if (rSupply < _rTotal.div(_tTotal)) return (_rTotal, _tTotal);
        return (rSupply, tSupply);
    }
    

    function _setBurnFee(uint256 burnFee) private {
        require(burnFee >= 0 && burnFee <= 1500, 'burnFee should be in 0 - 15');
        _BURN_FEE = burnFee;
    }
    
    function _setFeeStage(uint256 burnFee) external onlyOwner() {
        require(burnFee >= 0 && burnFee <= 1500, 'burnFee should be in 0 - 15');
        _BURN_FEE = burnFee;
    }

    function _getBurnFee() public view returns(uint256)  {
        return _BURN_FEE;
    }

    function _getMaxTxAmount() private view returns(uint256) {
        return _MAX_TX_SIZE;
    }

    function _getCycle() public view returns(uint256) {
        return _lightningCycle;
    }

    function _getBurnCycle() public view returns(uint256) {
        return _tBurnCycle;
    }

    function _getTradedCycle() public view returns(uint256) {
        return _tTradeCycle;
    }
    
    function _rebase(uint256 supplyDelta) internal {
        _lightningCycle = _lightningCycle.add(1);
        _tTotal = _tTotal.add(supplyDelta);


        // after 156, the protocol reaches its final stage
        // fees will be set to 0 and the remaining total supply will be 550,000
        if(_lightningCycle > 156 || _tTotal <= 550000 * _DECIMALFACTOR){
            _initializeFinalStage();
        }
    }

    function _initializeFinalStage() internal {
        _setBurnFee(0);
    }   
}